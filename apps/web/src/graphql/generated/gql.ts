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
    "\n  query Dashboard {\n    viewer {\n      id\n      email\n      demoMode\n      profile {\n        displayName\n        targetScore\n        examDate\n        dailyGoalMinutes\n        onboardingCompleted\n        level { code name cefr }\n      }\n      progress {\n        lessonsCompleted\n        lessonsTotal\n        overallRatio\n        skills { skill attempts accuracy }\n      }\n      streakDays\n      todayMinutes\n      reviewDueCount\n      vocabularyDueCount\n      studyPlan { createdAt recommendedLevelCode plan }\n      recentAttempts(limit: 5) { id createdAt isCorrect scoreRatio category { code name } }\n      recommendedLessons(limit: 3) { id slug title summary estimatedMinutes level { code cefr } }\n      weakAreas { accuracy attempts category { code name } }\n      mockExams(limit: 5) { id kind status startedAt completedAt }\n    }\n  }\n": typeof types.DashboardDocument,
    "\n  query Onboarding {\n    learningLevels { code name cefr description }\n    viewer {\n      profile { targetScore examDate dailyGoalMinutes onboardingCompleted level { code } }\n    }\n  }\n": typeof types.OnboardingDocument,
    "\n  query ProfilePage {\n    viewer {\n      email\n      roles\n      recordingConsent\n      profile { displayName targetScore examDate dailyGoalMinutes level { code name cefr } }\n    }\n  }\n": typeof types.ProfilePageDocument,
    "\n  query Lessons {\n    learningLevels { code name cefr }\n    lessons {\n      id slug title summary estimatedMinutes unitSlug\n      level { code }\n      progress { status bestScore }\n    }\n    units {\n      slug title summary locked\n      level { code }\n      progress { bestScore passed attempts }\n    }\n  }\n": typeof types.LessonsDocument,
    "\n  query Lesson($slug: String!) {\n    lesson(slug: $slug) {\n      id slug title summary estimatedMinutes locked unitSlug\n      level { code name cefr }\n      progress { status bestScore }\n      sections { kind title bodyMd exercises { id type prompt options hint } }\n    }\n  }\n": typeof types.LessonDocument,
    "\n  query PracticeHub {\n    speakingWriting: practiceTypes(section: \"speaking_writing\") {\n      category { code name section }\n      questionCount autoMarked attempts averageScore\n    }\n    reading: practiceTypes(section: \"reading\") {\n      category { code name section }\n      questionCount autoMarked attempts averageScore\n    }\n    listening: practiceTypes(section: \"listening\") {\n      category { code name section }\n      questionCount autoMarked attempts averageScore\n    }\n  }\n": typeof types.PracticeHubDocument,
    "\n  query PracticeQuestions($code: String!) {\n    practiceQuestions(categoryCode: $code) {\n      id externalId categoryCode difficulty instructions learningObjective content\n      options { label body }\n      category { code name section }\n    }\n  }\n": typeof types.PracticeQuestionsDocument,
    "\n  query Review {\n    viewer {\n      reviewDueCount\n      reviewItems(limit: 100) {\n        id box dueAt isDue wrongCount lastScore mastered\n        question { id externalId categoryCode category { name } }\n      }\n      due: reviewItems(dueOnly: true, limit: 20) {\n        id\n        question {\n          id externalId categoryCode difficulty instructions learningObjective content\n          options { label body }\n          category { code name section }\n        }\n      }\n    }\n  }\n": typeof types.ReviewDocument,
    "\n  query Placement {\n    placementTest { slug title estimatedMinutes items { id level skill prompt passage options hasAudio } }\n    learningLevels { code name cefr }\n  }\n": typeof types.PlacementDocument,
    "\n  query UnitTest($slug: String!) {\n    unit(slug: $slug) {\n      slug title summary locked\n      level { code name }\n      progress { bestScore passed attempts }\n      lessons { slug title progress { status } }\n      testItems { id type prompt options hint }\n    }\n  }\n": typeof types.UnitTestDocument,
    "\n  query VocabularyHub {\n    learningLevels { code name cefr }\n    vocabularySets { slug title levelCode wordCount seenCount masteredCount }\n    viewer { vocabularyDueCount }\n  }\n": typeof types.VocabularyHubDocument,
    "\n  query VocabularySet($slug: String!) {\n    vocabularySet(slug: $slug) {\n      slug title levelCode wordCount seenCount masteredCount\n      words { id externalId word partOfSpeech meaning example box mastered }\n    }\n  }\n": typeof types.VocabularySetDocument,
    "\n  query VocabularyReview {\n    viewer {\n      vocabularyDueCount\n      vocabularyDue(limit: 30) { id externalId word partOfSpeech meaning example box mastered }\n    }\n  }\n": typeof types.VocabularyReviewDocument,
    "\n  query PronunciationHub {\n    pronunciationTopics { slug kind title symbols bestScore attempts }\n  }\n": typeof types.PronunciationHubDocument,
    "\n  query PronunciationTopic($slug: String!) {\n    pronunciationTopic(slug: $slug) {\n      slug kind title symbols tip examples bestScore attempts\n      drill { id type prompt options }\n    }\n  }\n": typeof types.PronunciationTopicDocument,
    "\n  query RecordingConsent {\n    viewer { recordingConsent demoMode }\n  }\n": typeof types.RecordingConsentDocument,
    "\n  query AcademyHub {\n    speakingWriting: practiceTypes(section: \"speaking_writing\") { category { code name section } questionCount attempts }\n    reading: practiceTypes(section: \"reading\") { category { code name section } questionCount attempts }\n    listening: practiceTypes(section: \"listening\") { category { code name section } questionCount attempts }\n  }\n": typeof types.AcademyHubDocument,
    "\n  query QuestionType($code: String!) {\n    questionType(code: $code) { questionCount guide category { code name section skills } }\n    viewer {\n      typeHistory(categoryCode: $code, limit: 10) { id createdAt mode isCorrect scoreRatio }\n      evaluations(categoryCode: $code, limit: 5) { id status createdAt result }\n    }\n  }\n": typeof types.QuestionTypeDocument,
    "\n  query ExamsHub {\n    blueprints { code name kind about verified itemCount sections spec }\n    viewer { recordingConsent mockExams(limit: 10) { id kind status startedAt completedAt blueprintCode overallBand } }\n  }\n": typeof types.ExamsHubDocument,
};
const documents: Documents = {
    "\n  query Dashboard {\n    viewer {\n      id\n      email\n      demoMode\n      profile {\n        displayName\n        targetScore\n        examDate\n        dailyGoalMinutes\n        onboardingCompleted\n        level { code name cefr }\n      }\n      progress {\n        lessonsCompleted\n        lessonsTotal\n        overallRatio\n        skills { skill attempts accuracy }\n      }\n      streakDays\n      todayMinutes\n      reviewDueCount\n      vocabularyDueCount\n      studyPlan { createdAt recommendedLevelCode plan }\n      recentAttempts(limit: 5) { id createdAt isCorrect scoreRatio category { code name } }\n      recommendedLessons(limit: 3) { id slug title summary estimatedMinutes level { code cefr } }\n      weakAreas { accuracy attempts category { code name } }\n      mockExams(limit: 5) { id kind status startedAt completedAt }\n    }\n  }\n": types.DashboardDocument,
    "\n  query Onboarding {\n    learningLevels { code name cefr description }\n    viewer {\n      profile { targetScore examDate dailyGoalMinutes onboardingCompleted level { code } }\n    }\n  }\n": types.OnboardingDocument,
    "\n  query ProfilePage {\n    viewer {\n      email\n      roles\n      recordingConsent\n      profile { displayName targetScore examDate dailyGoalMinutes level { code name cefr } }\n    }\n  }\n": types.ProfilePageDocument,
    "\n  query Lessons {\n    learningLevels { code name cefr }\n    lessons {\n      id slug title summary estimatedMinutes unitSlug\n      level { code }\n      progress { status bestScore }\n    }\n    units {\n      slug title summary locked\n      level { code }\n      progress { bestScore passed attempts }\n    }\n  }\n": types.LessonsDocument,
    "\n  query Lesson($slug: String!) {\n    lesson(slug: $slug) {\n      id slug title summary estimatedMinutes locked unitSlug\n      level { code name cefr }\n      progress { status bestScore }\n      sections { kind title bodyMd exercises { id type prompt options hint } }\n    }\n  }\n": types.LessonDocument,
    "\n  query PracticeHub {\n    speakingWriting: practiceTypes(section: \"speaking_writing\") {\n      category { code name section }\n      questionCount autoMarked attempts averageScore\n    }\n    reading: practiceTypes(section: \"reading\") {\n      category { code name section }\n      questionCount autoMarked attempts averageScore\n    }\n    listening: practiceTypes(section: \"listening\") {\n      category { code name section }\n      questionCount autoMarked attempts averageScore\n    }\n  }\n": types.PracticeHubDocument,
    "\n  query PracticeQuestions($code: String!) {\n    practiceQuestions(categoryCode: $code) {\n      id externalId categoryCode difficulty instructions learningObjective content\n      options { label body }\n      category { code name section }\n    }\n  }\n": types.PracticeQuestionsDocument,
    "\n  query Review {\n    viewer {\n      reviewDueCount\n      reviewItems(limit: 100) {\n        id box dueAt isDue wrongCount lastScore mastered\n        question { id externalId categoryCode category { name } }\n      }\n      due: reviewItems(dueOnly: true, limit: 20) {\n        id\n        question {\n          id externalId categoryCode difficulty instructions learningObjective content\n          options { label body }\n          category { code name section }\n        }\n      }\n    }\n  }\n": types.ReviewDocument,
    "\n  query Placement {\n    placementTest { slug title estimatedMinutes items { id level skill prompt passage options hasAudio } }\n    learningLevels { code name cefr }\n  }\n": types.PlacementDocument,
    "\n  query UnitTest($slug: String!) {\n    unit(slug: $slug) {\n      slug title summary locked\n      level { code name }\n      progress { bestScore passed attempts }\n      lessons { slug title progress { status } }\n      testItems { id type prompt options hint }\n    }\n  }\n": types.UnitTestDocument,
    "\n  query VocabularyHub {\n    learningLevels { code name cefr }\n    vocabularySets { slug title levelCode wordCount seenCount masteredCount }\n    viewer { vocabularyDueCount }\n  }\n": types.VocabularyHubDocument,
    "\n  query VocabularySet($slug: String!) {\n    vocabularySet(slug: $slug) {\n      slug title levelCode wordCount seenCount masteredCount\n      words { id externalId word partOfSpeech meaning example box mastered }\n    }\n  }\n": types.VocabularySetDocument,
    "\n  query VocabularyReview {\n    viewer {\n      vocabularyDueCount\n      vocabularyDue(limit: 30) { id externalId word partOfSpeech meaning example box mastered }\n    }\n  }\n": types.VocabularyReviewDocument,
    "\n  query PronunciationHub {\n    pronunciationTopics { slug kind title symbols bestScore attempts }\n  }\n": types.PronunciationHubDocument,
    "\n  query PronunciationTopic($slug: String!) {\n    pronunciationTopic(slug: $slug) {\n      slug kind title symbols tip examples bestScore attempts\n      drill { id type prompt options }\n    }\n  }\n": types.PronunciationTopicDocument,
    "\n  query RecordingConsent {\n    viewer { recordingConsent demoMode }\n  }\n": types.RecordingConsentDocument,
    "\n  query AcademyHub {\n    speakingWriting: practiceTypes(section: \"speaking_writing\") { category { code name section } questionCount attempts }\n    reading: practiceTypes(section: \"reading\") { category { code name section } questionCount attempts }\n    listening: practiceTypes(section: \"listening\") { category { code name section } questionCount attempts }\n  }\n": types.AcademyHubDocument,
    "\n  query QuestionType($code: String!) {\n    questionType(code: $code) { questionCount guide category { code name section skills } }\n    viewer {\n      typeHistory(categoryCode: $code, limit: 10) { id createdAt mode isCorrect scoreRatio }\n      evaluations(categoryCode: $code, limit: 5) { id status createdAt result }\n    }\n  }\n": types.QuestionTypeDocument,
    "\n  query ExamsHub {\n    blueprints { code name kind about verified itemCount sections spec }\n    viewer { recordingConsent mockExams(limit: 10) { id kind status startedAt completedAt blueprintCode overallBand } }\n  }\n": types.ExamsHubDocument,
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
export function graphql(source: "\n  query Dashboard {\n    viewer {\n      id\n      email\n      demoMode\n      profile {\n        displayName\n        targetScore\n        examDate\n        dailyGoalMinutes\n        onboardingCompleted\n        level { code name cefr }\n      }\n      progress {\n        lessonsCompleted\n        lessonsTotal\n        overallRatio\n        skills { skill attempts accuracy }\n      }\n      streakDays\n      todayMinutes\n      reviewDueCount\n      vocabularyDueCount\n      studyPlan { createdAt recommendedLevelCode plan }\n      recentAttempts(limit: 5) { id createdAt isCorrect scoreRatio category { code name } }\n      recommendedLessons(limit: 3) { id slug title summary estimatedMinutes level { code cefr } }\n      weakAreas { accuracy attempts category { code name } }\n      mockExams(limit: 5) { id kind status startedAt completedAt }\n    }\n  }\n"): (typeof documents)["\n  query Dashboard {\n    viewer {\n      id\n      email\n      demoMode\n      profile {\n        displayName\n        targetScore\n        examDate\n        dailyGoalMinutes\n        onboardingCompleted\n        level { code name cefr }\n      }\n      progress {\n        lessonsCompleted\n        lessonsTotal\n        overallRatio\n        skills { skill attempts accuracy }\n      }\n      streakDays\n      todayMinutes\n      reviewDueCount\n      vocabularyDueCount\n      studyPlan { createdAt recommendedLevelCode plan }\n      recentAttempts(limit: 5) { id createdAt isCorrect scoreRatio category { code name } }\n      recommendedLessons(limit: 3) { id slug title summary estimatedMinutes level { code cefr } }\n      weakAreas { accuracy attempts category { code name } }\n      mockExams(limit: 5) { id kind status startedAt completedAt }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Onboarding {\n    learningLevels { code name cefr description }\n    viewer {\n      profile { targetScore examDate dailyGoalMinutes onboardingCompleted level { code } }\n    }\n  }\n"): (typeof documents)["\n  query Onboarding {\n    learningLevels { code name cefr description }\n    viewer {\n      profile { targetScore examDate dailyGoalMinutes onboardingCompleted level { code } }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ProfilePage {\n    viewer {\n      email\n      roles\n      recordingConsent\n      profile { displayName targetScore examDate dailyGoalMinutes level { code name cefr } }\n    }\n  }\n"): (typeof documents)["\n  query ProfilePage {\n    viewer {\n      email\n      roles\n      recordingConsent\n      profile { displayName targetScore examDate dailyGoalMinutes level { code name cefr } }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Lessons {\n    learningLevels { code name cefr }\n    lessons {\n      id slug title summary estimatedMinutes unitSlug\n      level { code }\n      progress { status bestScore }\n    }\n    units {\n      slug title summary locked\n      level { code }\n      progress { bestScore passed attempts }\n    }\n  }\n"): (typeof documents)["\n  query Lessons {\n    learningLevels { code name cefr }\n    lessons {\n      id slug title summary estimatedMinutes unitSlug\n      level { code }\n      progress { status bestScore }\n    }\n    units {\n      slug title summary locked\n      level { code }\n      progress { bestScore passed attempts }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Lesson($slug: String!) {\n    lesson(slug: $slug) {\n      id slug title summary estimatedMinutes locked unitSlug\n      level { code name cefr }\n      progress { status bestScore }\n      sections { kind title bodyMd exercises { id type prompt options hint } }\n    }\n  }\n"): (typeof documents)["\n  query Lesson($slug: String!) {\n    lesson(slug: $slug) {\n      id slug title summary estimatedMinutes locked unitSlug\n      level { code name cefr }\n      progress { status bestScore }\n      sections { kind title bodyMd exercises { id type prompt options hint } }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PracticeHub {\n    speakingWriting: practiceTypes(section: \"speaking_writing\") {\n      category { code name section }\n      questionCount autoMarked attempts averageScore\n    }\n    reading: practiceTypes(section: \"reading\") {\n      category { code name section }\n      questionCount autoMarked attempts averageScore\n    }\n    listening: practiceTypes(section: \"listening\") {\n      category { code name section }\n      questionCount autoMarked attempts averageScore\n    }\n  }\n"): (typeof documents)["\n  query PracticeHub {\n    speakingWriting: practiceTypes(section: \"speaking_writing\") {\n      category { code name section }\n      questionCount autoMarked attempts averageScore\n    }\n    reading: practiceTypes(section: \"reading\") {\n      category { code name section }\n      questionCount autoMarked attempts averageScore\n    }\n    listening: practiceTypes(section: \"listening\") {\n      category { code name section }\n      questionCount autoMarked attempts averageScore\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PracticeQuestions($code: String!) {\n    practiceQuestions(categoryCode: $code) {\n      id externalId categoryCode difficulty instructions learningObjective content\n      options { label body }\n      category { code name section }\n    }\n  }\n"): (typeof documents)["\n  query PracticeQuestions($code: String!) {\n    practiceQuestions(categoryCode: $code) {\n      id externalId categoryCode difficulty instructions learningObjective content\n      options { label body }\n      category { code name section }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Review {\n    viewer {\n      reviewDueCount\n      reviewItems(limit: 100) {\n        id box dueAt isDue wrongCount lastScore mastered\n        question { id externalId categoryCode category { name } }\n      }\n      due: reviewItems(dueOnly: true, limit: 20) {\n        id\n        question {\n          id externalId categoryCode difficulty instructions learningObjective content\n          options { label body }\n          category { code name section }\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query Review {\n    viewer {\n      reviewDueCount\n      reviewItems(limit: 100) {\n        id box dueAt isDue wrongCount lastScore mastered\n        question { id externalId categoryCode category { name } }\n      }\n      due: reviewItems(dueOnly: true, limit: 20) {\n        id\n        question {\n          id externalId categoryCode difficulty instructions learningObjective content\n          options { label body }\n          category { code name section }\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Placement {\n    placementTest { slug title estimatedMinutes items { id level skill prompt passage options hasAudio } }\n    learningLevels { code name cefr }\n  }\n"): (typeof documents)["\n  query Placement {\n    placementTest { slug title estimatedMinutes items { id level skill prompt passage options hasAudio } }\n    learningLevels { code name cefr }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query UnitTest($slug: String!) {\n    unit(slug: $slug) {\n      slug title summary locked\n      level { code name }\n      progress { bestScore passed attempts }\n      lessons { slug title progress { status } }\n      testItems { id type prompt options hint }\n    }\n  }\n"): (typeof documents)["\n  query UnitTest($slug: String!) {\n    unit(slug: $slug) {\n      slug title summary locked\n      level { code name }\n      progress { bestScore passed attempts }\n      lessons { slug title progress { status } }\n      testItems { id type prompt options hint }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query VocabularyHub {\n    learningLevels { code name cefr }\n    vocabularySets { slug title levelCode wordCount seenCount masteredCount }\n    viewer { vocabularyDueCount }\n  }\n"): (typeof documents)["\n  query VocabularyHub {\n    learningLevels { code name cefr }\n    vocabularySets { slug title levelCode wordCount seenCount masteredCount }\n    viewer { vocabularyDueCount }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query VocabularySet($slug: String!) {\n    vocabularySet(slug: $slug) {\n      slug title levelCode wordCount seenCount masteredCount\n      words { id externalId word partOfSpeech meaning example box mastered }\n    }\n  }\n"): (typeof documents)["\n  query VocabularySet($slug: String!) {\n    vocabularySet(slug: $slug) {\n      slug title levelCode wordCount seenCount masteredCount\n      words { id externalId word partOfSpeech meaning example box mastered }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query VocabularyReview {\n    viewer {\n      vocabularyDueCount\n      vocabularyDue(limit: 30) { id externalId word partOfSpeech meaning example box mastered }\n    }\n  }\n"): (typeof documents)["\n  query VocabularyReview {\n    viewer {\n      vocabularyDueCount\n      vocabularyDue(limit: 30) { id externalId word partOfSpeech meaning example box mastered }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PronunciationHub {\n    pronunciationTopics { slug kind title symbols bestScore attempts }\n  }\n"): (typeof documents)["\n  query PronunciationHub {\n    pronunciationTopics { slug kind title symbols bestScore attempts }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PronunciationTopic($slug: String!) {\n    pronunciationTopic(slug: $slug) {\n      slug kind title symbols tip examples bestScore attempts\n      drill { id type prompt options }\n    }\n  }\n"): (typeof documents)["\n  query PronunciationTopic($slug: String!) {\n    pronunciationTopic(slug: $slug) {\n      slug kind title symbols tip examples bestScore attempts\n      drill { id type prompt options }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query RecordingConsent {\n    viewer { recordingConsent demoMode }\n  }\n"): (typeof documents)["\n  query RecordingConsent {\n    viewer { recordingConsent demoMode }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query AcademyHub {\n    speakingWriting: practiceTypes(section: \"speaking_writing\") { category { code name section } questionCount attempts }\n    reading: practiceTypes(section: \"reading\") { category { code name section } questionCount attempts }\n    listening: practiceTypes(section: \"listening\") { category { code name section } questionCount attempts }\n  }\n"): (typeof documents)["\n  query AcademyHub {\n    speakingWriting: practiceTypes(section: \"speaking_writing\") { category { code name section } questionCount attempts }\n    reading: practiceTypes(section: \"reading\") { category { code name section } questionCount attempts }\n    listening: practiceTypes(section: \"listening\") { category { code name section } questionCount attempts }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query QuestionType($code: String!) {\n    questionType(code: $code) { questionCount guide category { code name section skills } }\n    viewer {\n      typeHistory(categoryCode: $code, limit: 10) { id createdAt mode isCorrect scoreRatio }\n      evaluations(categoryCode: $code, limit: 5) { id status createdAt result }\n    }\n  }\n"): (typeof documents)["\n  query QuestionType($code: String!) {\n    questionType(code: $code) { questionCount guide category { code name section skills } }\n    viewer {\n      typeHistory(categoryCode: $code, limit: 10) { id createdAt mode isCorrect scoreRatio }\n      evaluations(categoryCode: $code, limit: 5) { id status createdAt result }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ExamsHub {\n    blueprints { code name kind about verified itemCount sections spec }\n    viewer { recordingConsent mockExams(limit: 10) { id kind status startedAt completedAt blueprintCode overallBand } }\n  }\n"): (typeof documents)["\n  query ExamsHub {\n    blueprints { code name kind about verified itemCount sections spec }\n    viewer { recordingConsent mockExams(limit: 10) { id kind status startedAt completedAt blueprintCode overallBand } }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;