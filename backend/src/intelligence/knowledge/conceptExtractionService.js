/**
 * EDOT Intelligence Domain - Concept Extraction Service
 * 
 * Implements layered concept extraction across course metadata, lesson titles,
 * learning objectives, instructor tags, and content text.
 */

import { prisma } from '../../../lib/prisma.js';
import { findOrCreateKnowledgeNode } from './knowledgeGraphService.js';
import { mapContentToKnowledgeNode } from './contentIntelligenceService.js';

/**
 * Extracts concepts from course title, category, description, and learning objectives.
 * 
 * @param {string} courseId 
 */
export async function extractConceptsFromCourse(courseId) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { lessons: true }
  });

  if (!course) {
    throw new Error(`Course not found with ID "${courseId}".`);
  }

  const candidateNames = new Set();

  // Layer 1: Main Category & Subcategory
  if (course.mainCategory) candidateNames.add(course.mainCategory);
  if (course.subCategory) candidateNames.add(course.subCategory);

  // Layer 2: Course Title & Tags
  if (course.title) candidateNames.add(course.title);
  if (course.tags && Array.isArray(course.tags)) {
    course.tags.forEach(tag => candidateNames.add(tag));
  }

  // Layer 3: Learning Objectives (whatYouWillLearn)
  if (course.whatYouWillLearn && Array.isArray(course.whatYouWillLearn)) {
    course.whatYouWillLearn.forEach(objective => candidateNames.add(objective));
  }

  // Layer 4: Lessons
  if (course.lessons && Array.isArray(course.lessons)) {
    course.lessons.forEach(lesson => {
      if (lesson.title) candidateNames.add(lesson.title);
    });
  }

  const extractedNodes = [];

  for (const rawName of candidateNames) {
    if (!rawName || rawName.trim().length < 3) continue;

    try {
      const node = await findOrCreateKnowledgeNode({
        name: rawName,
        type: 'CONCEPT',
        domain: course.mainCategory || 'General',
        category: course.subCategory || null
      });

      await mapContentToKnowledgeNode({
        nodeId: node.id,
        courseId: course.id,
        contentType: 'COURSE',
        contentId: course.id,
        relevance: 0.9,
        confidence: 0.85,
        source: 'AI_EXTRACTED',
        reviewStatus: 'AUTO_DETECTED'
      });

      extractedNodes.push(node);
    } catch (err) {
      console.warn(`Skipped concept extraction for "${rawName}":`, err.message);
    }
  }

  return {
    courseId,
    extractedCount: extractedNodes.length,
    extractedNodes
  };
}

/**
 * Extracts concepts from a specific lesson.
 * 
 * @param {string} lessonId 
 */
export async function extractConceptsFromLesson(lessonId) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { course: true }
  });

  if (!lesson) {
    throw new Error(`Lesson not found with ID "${lessonId}".`);
  }

  const candidateNames = [lesson.title];
  if (lesson.description) candidateNames.push(lesson.description);

  const extractedNodes = [];

  for (const rawName of candidateNames) {
    if (!rawName || rawName.trim().length < 3) continue;

    try {
      const node = await findOrCreateKnowledgeNode({
        name: rawName,
        type: 'CONCEPT',
        domain: lesson.course?.mainCategory || 'General'
      });

      await mapContentToKnowledgeNode({
        nodeId: node.id,
        courseId: lesson.courseId,
        lessonId: lesson.id,
        contentType: 'LESSON',
        contentId: lesson.id,
        relevance: 1.0,
        confidence: 0.9,
        source: 'AI_EXTRACTED',
        reviewStatus: 'AUTO_DETECTED'
      });

      extractedNodes.push(node);
    } catch (err) {
      console.warn(`Skipped lesson concept extraction for "${rawName}":`, err.message);
    }
  }

  return {
    lessonId,
    extractedCount: extractedNodes.length,
    extractedNodes
  };
}
