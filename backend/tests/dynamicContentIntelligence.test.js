/**
 * Test Suite - EDOT Universal Dynamic Content Intelligence Lifecycle Engine
 * Verifies dynamic concept extraction, lifecycle event processing (Category, Course, Section,
 * Lesson, Quiz, Assignment, Update, Delete) and automated content indexing without hardcoded data.
 */

import {
  UniversalIntelligenceContext,
  extractConceptsDynamically,
  onCategoryCreated,
  onCourseCreated,
  onSectionCreated,
  onLessonCreated,
  onQuizCreated,
  onAssignmentCreated,
  onContentUpdated,
  onContentDeleted,
  dynamicallyIndexAllExistingContent
} from '../src/intelligence/dynamic/dynamicContentIntelligenceEngine.js';
import { prisma } from '../lib/prisma.js';

async function runDynamicContentTestSuite() {
  console.log('🧪 Starting Universal Dynamic Content Intelligence Test Suite...\n');

  try {
    // 1. Universal Context Initialization
    console.log('--- 1. Testing Universal Intelligence Context ---');
    const ctx = new UniversalIntelligenceContext({
      userId: 'test-user-id',
      categoryId: 'cat-science-1',
      courseId: 'course-quantum-1',
      sectionId: 'sec-1',
      lessonId: 'les-1',
      resourceType: 'VIDEO',
      resourceId: 'res-vid-1'
    });

    if (ctx.categoryId && ctx.courseId && ctx.resourceType === 'VIDEO') {
      console.log('✅ Universal Intelligence Context PASSED');
    } else {
      throw new Error('Universal Intelligence Context failed');
    }

    // 2. Dynamic Concept Extraction (No Hardcoding)
    console.log('\n--- 2. Testing Dynamic Concept Extraction on Arbitrary Content ---');
    const arbitraryText = 'Quantum computing leverages quantum superposition and quantum entanglement to execute parallel algorithms with exponential acceleration over classical silicon processors.';
    const concepts = extractConceptsDynamically(arbitraryText);
    console.log('Extracted Concepts:', concepts);

    if (concepts.includes('Quantum') && concepts.length > 0) {
      console.log('✅ Dynamic concept extraction PASSED');
    } else {
      throw new Error('Dynamic concept extraction failed');
    }

    // 3. Lifecycle Handlers: Category, Course, Section, Lesson, Quiz, Assignment
    console.log('\n--- 3. Testing Dynamic Content Lifecycle Handlers ---');
    
    // Category Created
    const catResult = await onCategoryCreated({ id: 'cat-new-1', name: 'Biomedical Engineering' });
    console.log('Category Created:', catResult.status);

    // Course Created
    const courseResult = await onCourseCreated({ 
      id: 'course-bio-101', 
      title: 'Neural Prosthetics and Brain-Computer Interfaces',
      description: 'Understanding neural signal decoding, electrode arrays, and bio-compatible materials.',
      category: 'Biomedical'
    });
    console.log('Course Created:', courseResult.status, '| Skills indexed:', courseResult.skillCount);

    // Section Created
    const secResult = await onSectionCreated({ id: 'sec-bio-1', courseId: 'course-bio-101' });
    console.log('Section Created:', secResult.status);

    // Lesson Created
    const lessonResult = await onLessonCreated({
      id: 'les-bio-1',
      courseId: 'course-bio-101',
      title: 'Electrode Impedance and Signal-to-Noise Ratio',
      content: 'Measuring electrical impedance at neural interface boundaries.'
    });
    console.log('Lesson Created:', lessonResult.status, '| Concepts:', lessonResult.concepts);

    // Quiz Created
    const quizResult = await onQuizCreated({ id: 'quiz-bio-1', courseId: 'course-bio-101', title: 'Impedance Quiz' });
    console.log('Quiz Created:', quizResult.status);

    // Assignment Created
    const assignResult = await onAssignmentCreated({ id: 'assign-bio-1', courseId: 'course-bio-101' });
    console.log('Assignment Created:', assignResult.status);

    // Content Updated
    const updateResult = await onContentUpdated({ entityType: 'COURSE', entityId: 'course-bio-101' });
    console.log('Content Updated:', updateResult.status, '| Evidence Preserved:', updateResult.historicalLearnerDataPreserved);

    // Content Deleted
    const deleteResult = await onContentDeleted({ entityType: 'COURSE', entityId: 'course-bio-101' });
    console.log('Content Deleted:', deleteResult.status, '| Historical Evidence Preserved:', deleteResult.historicalEvidencePreserved);

    if (
      catResult.status === 'INDEXED' &&
      courseResult.knowledgeReady &&
      updateResult.historicalLearnerDataPreserved &&
      deleteResult.historicalEvidencePreserved
    ) {
      console.log('✅ Dynamic Content Lifecycle Handlers PASSED');
    } else {
      throw new Error('Lifecycle handlers test failed');
    }

    // 4. Automated Database Sync & Indexing of All Existing Content
    console.log('\n--- 4. Testing Universal Indexing of All Existing Database Content ---');
    const syncResult = await dynamicallyIndexAllExistingContent();
    console.log('Universal Sync Output:', JSON.stringify(syncResult, null, 2));

    if (syncResult.totalCoursesIndexed > 0 && syncResult.dynamicIndexStatus === 'ALL_CONTENT_AUTOMATICALLY_SUPPORTED') {
      console.log('✅ Universal dynamic indexing of all database content PASSED');
    } else {
      throw new Error('Database dynamic indexing test failed');
    }

    console.log('\n🎉 ALL DYNAMIC CONTENT INTELLIGENCE TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runDynamicContentTestSuite();
