import express from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma.js';
import { hashPassword, comparePassword } from '../lib/modelHelpers.js';
import generateToken from '../utils/generateToken.js';
import { logActivity } from '../controllers/activityController.js';
import { protect } from '../middleware/auth.js';
import { publishLearningEvent } from '../src/intelligence/events/learningEventService.js';
import { onStudentCreated } from '../src/intelligence/profile/dynamicLearnerIntelligenceEngine.js';

const router = express.Router();

router.post('/register', [
  body('name').not().isEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please include a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, password, role } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  const allowedRoles = ['student', 'instructor', 'parent', 'sponsor'];
  const finalRole = allowedRoles.includes(role) ? role : 'student';
  const initialStatus = 'pending';

  try {
    let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await hashPassword(password);

    user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashedPassword,
        role: finalRole,
        status: initialStatus
      }
    });

    if (finalRole === 'student') {
      onStudentCreated(user.id, { name, email: normalizedEmail }).catch(err => console.error('[LearnerIntelligence] Non-blocking init failed:', err.message));
    }

    await logActivity(
      user.id, 
      'Registered a new account', 
      'auth', 
      'Initial account creation', 
      null, 
      'public', 
      null, 
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      message: user.status === 'pending' 
        ? 'Account created successfully. Awaiting administrator approval.' 
        : 'Account created successfully. You can now log in.'
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', [
  body('email').isEmail().withMessage('Please include a valid email'),
  body('password').exists().withMessage('Password is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;
  const normalizedEmail = String(email || '').replace(/[\s\uFEFF\xA0]/g, '').toLowerCase();

  try {
    import('fs').then(fs => {
        fs.writeFileSync('last_login_attempt.txt', JSON.stringify({ 
          receivedEmail: email, 
          receivedPasswordLength: password?.length,
          normalized: normalizedEmail,
          timestamp: new Date().toISOString()
        }, null, 2));
    }).catch(e => console.error(e));
    
    console.log(`[Login Attempt] Email: ${normalizedEmail}`);
    let user = await prisma.user.findFirst({ 
      where: { 
        email: { 
          equals: normalizedEmail, 
          mode: 'insensitive' 
        } 
      } 
    });

    if (!user) {
      const parts = normalizedEmail.split('@');
      if (parts.length > 0) {
          user = await prisma.user.findFirst({
              where: { email: { startsWith: parts[0], mode: 'insensitive' } }
          });
      }
    }

    if (!user) {
      console.log(`[Login Failed] User not found for email: ${email}`);
      return res.status(401).json({ message: 'Invalid credentials. User not found.' });
    }

    if (user.status === 'pending') {
      return res.status(403).json({ message: 'Account is pending administrator approval.' });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({ message: 'Account has been rejected. Contact support.' });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({ message: 'Account has been blocked. Contact support.' });
    }

    const isMatch = await comparePassword(password, user.password);
    console.log(`[Login Attempt] Password match result: ${isMatch}`);

    if (!isMatch) {
      console.log(`[Login Failed] Incorrect password for email: ${email}`);
      return res.status(401).json({ message: 'Invalid credentials. Incorrect password.' });
    }

    const token = generateToken(user.id);

    await logActivity(
      user.id, 
      'Logged in to EDOT Platform', 
      'auth', 
      'Session authenticated securely', 
      null, 
      'public', 
      null, 
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );

    // Fire-and-forget: emit LOGIN event to learning event pipeline
    publishLearningEvent({
      userId: user.id,
      eventType: 'LOGIN',
      context: { ip: req.ip, userAgent: req.headers['user-agent'] }
    }).catch(() => {});

    res.cookie('token', token, {
        httpOnly: true,  
        secure: process.env.NODE_ENV === 'production',   
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', 
        maxAge: 7 * 24 * 60 * 60 * 1000  
    });

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Secure Firebase cryptographic JWT ID Token verifier (Google Identity API)
const verifyFirebaseToken = async (idToken) => {
  try {
    const firebaseApiKey = process.env.FIREBASE_API_KEY || "AIzaSyAT5qol-jbgUCF57lpV9Ty5xFG1NgTgHRs";
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Firebase token verification HTTP error:', errorData);
      return null;
    }
    
    const data = await response.json();
    if (data.users && data.users.length > 0) {
      return data.users[0]; // Returns { localId, email, displayName, emailVerified, ... }
    }
    return null;
  } catch (err) {
    console.error('Firebase token verification exception:', err);
    return null;
  }
};

router.post('/social', async (req, res) => {
  const { provider, email, name, idToken } = req.body;
  
  if (!provider) {
    return res.status(400).json({ message: 'Authentication provider is required' });
  }

  let verifiedEmail = String(email || '').trim().toLowerCase();
  let verifiedName = name;

  // Strong Security Enforcement: Verify the Firebase ID Token cryptographically
  if (idToken) {
    const verifiedUser = await verifyFirebaseToken(idToken);
    if (!verifiedUser || !verifiedUser.email) {
      return res.status(401).json({ message: 'Invalid or expired Firebase authentication token. Access denied.' });
    }
    // Trust ONLY the verified parameters cryptographically returned by Google
    verifiedEmail = verifiedUser.email.trim().toLowerCase();
    verifiedName = verifiedUser.displayName || verifiedName || `${provider} User`;
  } else {
    // Fail-safe protection: Reject empty tokens in production environments
    return res.status(401).json({ message: 'Authentication token is required for security verification.' });
  }

  try {
    let user = await prisma.user.findFirst({ 
      where: { 
        email: { equals: verifiedEmail, mode: 'insensitive' } 
      } 
    });

    if (!user) {
      const randomPassword = await hashPassword(Math.random().toString(36).slice(-10) + 'Xy9!');
      user = await prisma.user.create({
        data: {
          name: verifiedName || `${provider} User`,
          email: verifiedEmail,
          password: randomPassword,
          role: 'student',
          status: 'active'
        }
      });
    }

    if (user.status === 'pending') return res.status(403).json({ message: 'Account pending.' });
    if (user.status === 'blocked' || user.status === 'rejected') return res.status(403).json({ message: 'Account unavailable.' });

    const token = generateToken(user.id);
    
    await logActivity(
      user.id, 
      `Logged in via ${provider}`, 
      'auth', 
      'Social authentication', 
      null, 
      'public', 
      null, 
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );

    res.cookie('token', token, {
        httpOnly: true,  
        secure: process.env.NODE_ENV === 'production',   
        sameSite: 'none', 
        maxAge: 7 * 24 * 60 * 60 * 1000  
    });

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error during social login' });
  }
});

router.get('/me', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userCourseProgress: {
          include: { course: true }
        },
        learnerGroups: true
      }
    });
    
    if (user) {
      delete user.password;
      user.enrolledCourses = user.userCourseProgress || [];
    }
    
    res.json({ user });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/logout', (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });
  res.status(200).json({ success: true, message: 'User logged out successfully' });
});

export default router;