/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  query Dashboard {\n    viewer {\n      id\n      email\n      demoMode\n      profile {\n        displayName\n        targetScore\n        examDate\n        dailyGoalMinutes\n        onboardingCompleted\n        level { code name cefr }\n      }\n      progress {\n        lessonsCompleted\n        lessonsTotal\n        overallRatio\n        skills { skill attempts accuracy }\n      }\n      streakDays\n      todayMinutes\n      recentAttempts(limit: 5) { id createdAt isCorrect scoreRatio category { code name } }\n      recommendedLessons(limit: 3) { id slug title summary estimatedMinutes level { code cefr } }\n      weakAreas { accuracy attempts category { code name } }\n      mockExams(limit: 5) { id kind status startedAt completedAt }\n    }\n  }\n": typeof types.DashboardDocument,
    "\n  query Onboarding {\n    learningLevels { code name cefr description }\n    viewer {\n      profile { targetScore examDate dailyGoalMinutes onboardingCompleted level { code } }\n    }\n  }\n": typeof types.OnboardingDocument,
    "\n  query ProfilePage {\n    viewer {\n      email\n      roles\n      profile { displayName targetScore examDate dailyGoalMinutes level { code name cefr } }\n    }\n  }\n": typeof types.ProfilePageDocument,
    "\n  query Lessons {\n    learningLevels { code name cefr }\n    lessons {\n      id slug title summary estimatedMinutes\n      level { code }\n      progress { status bestScore }\n    }\n  }\n": typeof types.LessonsDocument,
    "\n  query Lesson($slug: String!) {\n    lesson(slug: $slug) {\n      id slug title summary estimatedMinutes\n      level { code name cefr }\n      progress { status bestScore }\n      sections { kind title bodyMd exercises { id type prompt options hint } }\n    }\n  }\n": typeof types.LessonDocument,
    "\n  query PracticeHub {\n    reading: practiceTypes(section: \"reading\") {\n      category { code name section }\n      questionCount autoMarked attempts averageScore\n    }\n  }\n": typeof types.PracticeHubDocument,
    "\n  query PracticeQuestions($code: String!) {\n    practiceQuestions(categoryCode: $code) {\n      id externalId categoryCode difficulty instructions learningObjective content\n      options { label body }\n      category { code name section }\n    }\n  }\n": typeof types.PracticeQuestionsDocument,
};
const documents: Documents = {
    "\n  query Dashboard {\n    viewer {\n      id\n      email\n      demoMode\n      profile {\n        displayName\n        targetScore\n        examDate\n        dailyGoalMinutes\n        onboardingCompleted\n        level { code name cefr }\n      }\n      progress {\n        lessonsCompleted\n        lessonsTotal\n        overallRatio\n        skills { skill attempts accuracy }\n      }\n      streakDays\n      todayMinutes\n      recentAttempts(limit: 5) { id createdAt isCorrect scoreRatio category { code name } }\n      recommendedLessons(limit: 3) { id slug title summary estimatedMinutes level { code cefr } }\n      weakAreas { accuracy attempts category { code name } }\n      mockExams(limit: 5) { id kind status startedAt completedAt }\n    }\n  }\n": types.DashboardDocument,
    "\n  query Onboarding {\n    learningLevels { code name cefr description }\n    viewer {\n      profile { targetScore examDate dailyGoalMinutes onboardingCompleted level { code } }\n    }\n  }\n": types.OnboardingDocument,
    "\n  query ProfilePage {\n    viewer {\n      email\n      roles\n      profile { displayName targetScore examDate dailyGoalMinutes level { code name cefr } }\n    }\n  }\n": types.ProfilePageDocument,
    "\n  query Lessons {\n    learningLevels { code name cefr }\n    lessons {\n      id slug title summary estimatedMinutes\n      level { code }\n      progress { status bestScore }\n    }\n  }\n": types.LessonsDocument,
    "\n  query Lesson($slug: String!) {\n    lesson(slug: $slug) {\n      id slug title summary estimatedMinutes\n      level { code name cefr }\n      progress { status bestScore }\n      sections { kind title bodyMd exercises { id type prompt options hint } }\n    }\n  }\n": types.LessonDocument,
    "\n  query PracticeHub {\n    reading: practiceTypes(section: \"reading\") {\n      category { code name section }\n      questionCount autoMarked attempts averageScore\n    }\n  }\n": types.PracticeHubDocument,
    "\n  query PracticeQuestions($code: String!) {\n    practiceQuestions(categoryCode: $code) {\n      id externalId categoryCode difficulty instructions learningObjective content\n      options { label body }\n      category { code name section }\n    }\n  }\n": types.PracticeQuestionsDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Dashboard {\n    viewer {\n      id\n      email\n      demoMode\n      profile {\n        displayName\n        targetScore\n        examDate\n        dailyGoalMinutes\n        onboardingCompleted\n        level { code name cefr }\n      }\n      progress {\n        lessonsCompleted\n        lessonsTotal\n        overallRatio\n        skills { skill attempts accuracy }\n      }\n      streakDays\n      todayMinutes\n      recentAttempts(limit: 5) { id createdAt isCorrect scoreRatio category { code name } }\n      recommendedLessons(limit: 3) { id slug title summary estimatedMinutes level { code cefr } }\n      weakAreas { accuracy attempts category { code name } }\n      mockExams(limit: 5) { id kind status startedAt completedAt }\n    }\n  }\n"): (typeof documents)["\n  query Dashboard {\n    viewer {\n      id\n      email\n      demoMode\n      profile {\n        displayName\n        targetScore\n        examDate\n        dailyGoalMinutes\n        onboardingCompleted\n        level { code name cefr }\n      }\n      progress {\n        lessonsCompleted\n        lessonsTotal\n        overallRatio\n        skills { skill attempts accuracy }\n      }\n      streakDays\n      todayMinutes\n      recentAttempts(limit: 5) { id createdAt isCorrect scoreRatio category { code name } }\n      recommendedLessons(limit: 3) { id slug title summary estimatedMinutes level { code cefr } }\n      weakAreas { accuracy attempts category { code name } }\n      mockExams(limit: 5) { id kind status startedAt completedAt }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Onboarding {\n    learningLevels { code name cefr description }\n    viewer {\n      profile { targetScore examDate dailyGoalMinutes onboardingCompleted level { code } }\n    }\n  }\n"): (typeof documents)["\n  query Onboarding {\n    learningLevels { code name cefr description }\n    viewer {\n      profile { targetScore examDate dailyGoalMinutes onboardingCompleted level { code } }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ProfilePage {\n    viewer {\n      email\n      roles\n      profile { displayName targetScore examDate dailyGoalMinutes level { code name cefr } }\n    }\n  }\n"): (typeof documents)["\n  query ProfilePage {\n    viewer {\n      email\n      roles\n      profile { displayName targetScore examDate dailyGoalMinutes level { code name cefr } }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Lessons {\n    learningLevels { code name cefr }\n    lessons {\n      id slug title summary estimatedMinutes\n      level { code }\n      progress { status bestScore }\n    }\n  }\n"): (typeof documents)["\n  query Lessons {\n    learningLevels { code name cefr }\n    lessons {\n      id slug title summary estimatedMinutes\n      level { code }\n      progress { status bestScore }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Lesson($slug: String!) {\n    lesson(slug: $slug) {\n      id slug title summary estimatedMinutes\n      level { code name cefr }\n      progress { status bestScore }\n      sections { kind title bodyMd exercises { id type prompt options hint } }\n    }\n  }\n"): (typeof documents)["\n  query Lesson($slug: String!) {\n    lesson(slug: $slug) {\n      id slug title summary estimatedMinutes\n      level { code name cefr }\n      progress { status bestScore }\n      sections { kind title bodyMd exercises { id type prompt options hint } }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PracticeHub {\n    reading: practiceTypes(section: \"reading\") {\n      category { code name section }\n      questionCount autoMarked attempts averageScore\n    }\n  }\n"): (typeof documents)["\n  query PracticeHub {\n    reading: practiceTypes(section: \"reading\") {\n      category { code name section }\n      questionCount autoMarked attempts averageScore\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PracticeQuestions($code: String!) {\n    practiceQuestions(categoryCode: $code) {\n      id externalId categoryCode difficulty instructions learningObjective content\n      options { label body }\n      category { code name section }\n    }\n  }\n"): (typeof documents)["\n  query PracticeQuestions($code: String!) {\n    practiceQuestions(categoryCode: $code) {\n      id externalId categoryCode difficulty instructions learningObjective content\n      options { label body }\n      category { code name section }\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;