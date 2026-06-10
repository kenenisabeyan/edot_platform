#!/usr/bin/env node
/**
 * EDOT Platform Cleanup & Optimization Script
 * Removes redundant files and test scripts
 * WARNING: This script DELETES files. Ensure you have backups!
 */

import fs from 'fs';
import path from 'path';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

const scriptsToDelete = [
    // Old dashboard routes (now consolidated)
    { path: './routes/dashboardRoutes.js', reason: 'Consolidated into dashboardRoutes.consolidated.js' },
    { path: './routes/newDashboardRoutes.js', reason: 'Consolidated into dashboardRoutes.consolidated.js' },
    
    // Old dashboard service (now optimized)
    { path: './services/dashboardService.js', reason: 'Replaced by dashboardService.optimized.js' },
    
    // Redundant test scripts
    { path: './scripts/test_api.js', reason: 'Redundant test file' },
    { path: './scripts/test_api.cjs', reason: 'Duplicate test file (CJS version)' },
    { path: './scripts/test_api_debug.cjs', reason: 'Debug version of test_api' },
    { path: './scripts/test_api_fetch.cjs', reason: 'Duplicate test file (fetch version)' },
    { path: './scripts/test-api.js', reason: 'Duplicate test file (dash version)' },
    { path: './scripts/test-courses.js', reason: 'Old test file' },
    { path: './scripts/test-courses-2.js', reason: 'Duplicate test file' },
    { path: './scripts/test-enrollment-approval.js', reason: 'Old test file' },
    { path: './scripts/testLogin.js', reason: 'Old test file' },
    
    // Redundant database check scripts
    { path: './scripts/check_admin.js', reason: 'Redundant check script' },
    { path: './scripts/check_local_db.cjs', reason: 'Redundant DB check script' },
    { path: './scripts/check_urls.js', reason: 'Redundant check script' },
    { path: './scripts/checkExistingUsers.js', reason: 'Duplicate of checkUsers.js' },
    { path: './scripts/checkUsers.js', reason: 'Redundant (use admin dashboard instead)' },
    { path: './scripts/checkKedane.js', reason: 'Test-specific script' },
    { path: './scripts/checkKedaneData.js', reason: 'Test-specific script' },
    
    // Redundant user creation scripts
    { path: './scripts/createKedane.js', reason: 'Test-specific script' },
    { path: './scripts/createKeno.js', reason: 'Test-specific script' },
    { path: './scripts/createTest500.js', reason: 'Test-specific script' },
    { path: './scripts/createTestUsers.js', reason: 'Test-specific script' },
    { path: './scripts/seedAllTestUsers.js', reason: 'Test seed script' },
    { path: './scripts/seedKedane.js', reason: 'Test-specific script' },
    
    // Old migrations and seeds
    { path: './scripts/migrate_db.cjs', reason: 'Replaced by Prisma migrations' },
    { path: './scripts/delete_seeds.cjs', reason: 'Redundant script' },
    { path: './scripts/delete_seeds.js', reason: 'Redundant script' },
    { path: './scripts/seed_certificates.cjs', reason: 'Old seed script' },
    { path: './scripts/seed_course.js', reason: 'Old seed script' },
    { path: './scripts/seed_groups.js', reason: 'Old seed script' },
    
    // Redundant database test scripts
    { path: './scripts/dbtest.cjs', reason: 'Old DB test' },
    { path: './scripts/dbtest2.cjs', reason: 'Duplicate DB test' },
    { path: './scripts/dbtest_blue.cjs', reason: 'Another DB test variant' },
    { path: './scripts/dbtest_rapid_users.cjs', reason: 'Performance test (not needed)' },
    { path: './scripts/test_prisma_pool.cjs', reason: 'Connection pool test' },
    
    // Old utility scripts
    { path: './scripts/list_all_videos.cjs', reason: 'Old utility' },
    { path: './scripts/list_videos.cjs', reason: 'Duplicate utility' },
    { path: './scripts/listAllUsers.js', reason: 'Redundant (use admin dashboard)' },
    { path: './scripts/check_materials.js', reason: 'Old utility' },
    { path: './scripts/clean_courses.js', reason: 'Old cleanup script' },
    { path: './scripts/removeDuplicates.js', reason: 'Old utility' },
    
    // Password and verification scripts
    { path: './scripts/reset-pass.js', reason: 'Use admin dashboard instead' },
    { path: './scripts/updatePasswords.js', reason: 'Old script' },
    { path: './scripts/updateMyAccount.js', reason: 'Redundant' },
    { path: './scripts/unifyPasswords.js', reason: 'Old utility' },
    { path: './scripts/verify_real_qr.js', reason: 'Test script' },
    
    // Upload and media scripts
    { path: './scripts/upload_assets.js', reason: 'Old upload script' },
    { path: './scripts/upload_qano.js', reason: 'Test upload script' },
    { path: './scripts/upload_qano_actual.cjs', reason: 'Duplicate upload script' },
    { path: './scripts/migrate_frontend_assets.js', reason: 'Old migration script' },
    { path: './scripts/migrate_media.js', reason: 'Old migration script' },
    
    // Scratch and test files
    { path: './scripts/scratch.cjs', reason: 'Scratch file' },
    { path: './scripts/scratch_check_data.js', reason: 'Scratch file' },
    
    // Legacy test images
    { path: './scripts/test_image.png', reason: 'Test file' },
];

function deleteFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`Error deleting ${filePath}:`, error.message);
        return false;
    }
}

function main() {
    console.log(`\n${GREEN}================================================${RESET}`);
    console.log(`${GREEN}  EDOT Platform Cleanup & Optimization Script${RESET}`);
    console.log(`${GREEN}================================================${RESET}\n`);

    console.log(`${YELLOW}Files marked for deletion:${RESET}\n`);

    let deleted = 0;
    let failed = 0;
    let skipped = 0;

    scriptsToDelete.forEach(({ path: filePath, reason }) => {
        const absolutePath = path.resolve(filePath);
        const exists = fs.existsSync(absolutePath);
        
        if (exists) {
            const success = deleteFile(absolutePath);
            if (success) {
                console.log(`${GREEN}✓ DELETED${RESET} ${filePath}`);
                console.log(`  Reason: ${reason}\n`);
                deleted++;
            } else {
                console.log(`${RED}✗ FAILED${RESET} ${filePath}`);
                console.log(`  Reason: ${reason}\n`);
                failed++;
            }
        } else {
            console.log(`${YELLOW}⊘ SKIPPED${RESET} ${filePath} (not found)`);
            console.log(`  Reason: ${reason}\n`);
            skipped++;
        }
    });

    console.log(`${GREEN}================================================${RESET}`);
    console.log(`${GREEN}Cleanup Summary:${RESET}`);
    console.log(`  ${GREEN}✓ Deleted: ${deleted}${RESET}`);
    console.log(`  ${RED}✗ Failed: ${failed}${RESET}`);
    console.log(`  ${YELLOW}⊘ Skipped: ${skipped}${RESET}`);
    console.log(`${GREEN}================================================\n${RESET}`);

    if (failed > 0) {
        process.exit(1);
    }
}

main();
