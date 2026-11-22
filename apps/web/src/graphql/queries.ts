import { graphql } from "@/graphql/generated";

/** The whole dashboard loads in ONE GraphQL request (M1 acceptance). */
export const DashboardQuery = graphql(`
  query Dashboard {
    viewer {
      id
      email
      demoMode
      profile {
        displayName
        targetScore
        examDate
        dailyGoalMinutes
        onboardingCompleted
        level { code name cefr }
      }
      progress {
        lessonsCompleted
        lessonsTotal
        overallRatio
        skills { skill attempts accuracy }
      }
      streakDays
      todayMinutes
      reviewDueCount
      vocabularyDueCount
      studyPlan { createdAt recommendedLevelCode plan }
      recentAttempts(limit: 5) { id createdAt isCorrect scoreRatio category { code name } }
      recommendedLessons(limit: 3) { id slug title summary estimatedMinutes level { code cefr } }
      weakAreas { accuracy attempts category { code name } }
      mockExams(limit: 5) { id kind status startedAt completedAt }
      coach { recommendations }
    }
    practiceTypes: questionCategories { code name }
  }
`);

export const OnboardingQuery = graphql(`
  query Onboarding {
    learningLevels { code name cefr description }
    viewer {
      profile { targetScore examDate dailyGoalMinutes onboardingCompleted level { code } }
    }
  }
`);

export const ProfileQuery = graphql(`
  query ProfilePage {
    viewer {
      email
      roles
      recordingConsent
      profile { displayName targetScore examDate dailyGoalMinutes level { code name cefr } }
    }
  }
`);

export const LessonsQuery = graphql(`
  query Lessons {
    learningLevels { code name cefr }
    lessons {
      id slug title summary estimatedMinutes unitSlug
      level { code }
      progress { status bestScore }
    }
    units {
      slug title summary locked
      level { code }
      progress { bestScore passed attempts }
    }
  }
`);

export const LessonQuery = graphql(`
  query Lesson($slug: String!) {
    lesson(slug: $slug) {
      id slug title summary estimatedMinutes locked unitSlug
      level { code name cefr }
      progress { status bestScore }
      sections { kind title bodyMd exercises { id type prompt options hint } }
    }
  }
`);

export const PracticeHubQuery = graphql(`
  query PracticeHub {
    speakingWriting: practiceTypes(section: "speaking_writing") {
      category { code name section }
      questionCount autoMarked attempts averageScore
    }
    reading: practiceTypes(section: "reading") {
      category { code name section }
      questionCount autoMarked attempts averageScore
    }
    listening: practiceTypes(section: "listening") {
      category { code name section }
      questionCount autoMarked attempts averageScore
    }
  }
`);

export const PracticeQuestionsQuery = graphql(`
  query PracticeQuestions($code: String!, $adaptive: Boolean! = false) {
    practiceQuestions(categoryCode: $code, adaptive: $adaptive) {
      id externalId categoryCode difficulty instructions learningObjective content
      options { label body }
      category { code name section }
    }
  }
`);

export const ReviewQuery = graphql(`
  query Review {
    viewer {
      reviewDueCount
      reviewItems(limit: 100) {
        id box dueAt isDue wrongCount lastScore mastered
        question { id externalId categoryCode category { name } }
      }
      due: reviewItems(dueOnly: true, limit: 20) {
        id
        question {
          id externalId categoryCode difficulty instructions learningObjective content
          options { label body }
          category { code name section }
        }
      }
    }
  }
`);

export const PlacementQuery = graphql(`
  query Placement {
    placementTest { slug title estimatedMinutes items { id level skill prompt passage options hasAudio } }
    learningLevels { code name cefr }
  }
`);

export const UnitTestQuery = graphql(`
  query UnitTest($slug: String!) {
    unit(slug: $slug) {
      slug title summary locked
      level { code name }
      progress { bestScore passed attempts }
      lessons { slug title progress { status } }
      testItems { id type prompt options hint }
    }
  }
`);

export const VocabularyHubQuery = graphql(`
  query VocabularyHub {
    learningLevels { code name cefr }
    vocabularySets { slug title levelCode wordCount seenCount masteredCount }
    viewer { vocabularyDueCount }
  }
`);

export const VocabularySetQuery = graphql(`
  query VocabularySet($slug: String!) {
    vocabularySet(slug: $slug) {
      slug title levelCode wordCount seenCount masteredCount
      words { id externalId word partOfSpeech meaning example box mastered }
    }
  }
`);

export const VocabularyReviewQuery = graphql(`
  query VocabularyReview {
    viewer {
      vocabularyDueCount
      vocabularyDue(limit: 30) { id externalId word partOfSpeech meaning example box mastered }
    }
  }
`);

export const PronunciationHubQuery = graphql(`
  query PronunciationHub {
    pronunciationTopics { slug kind title symbols bestScore attempts }
  }
`);

export const PronunciationTopicQuery = graphql(`
  query PronunciationTopic($slug: String!) {
    pronunciationTopic(slug: $slug) {
      slug kind title symbols tip examples bestScore attempts
      drill { id type prompt options }
    }
  }
`);

export const RecordingConsentQuery = graphql(`
  query RecordingConsent {
    viewer { recordingConsent demoMode }
  }
`);

export const AcademyHubQuery = graphql(`
  query AcademyHub {
    speakingWriting: practiceTypes(section: "speaking_writing") { category { code name section } questionCount attempts }
    reading: practiceTypes(section: "reading") { category { code name section } questionCount attempts }
    listening: practiceTypes(section: "listening") { category { code name section } questionCount attempts }
  }
`);

export const QuestionTypeQuery = graphql(`
  query QuestionType($code: String!) {
    questionType(code: $code) { questionCount guide category { code name section skills } }
    viewer {
      typeHistory(categoryCode: $code, limit: 10) { id createdAt mode isCorrect scoreRatio }
      evaluations(categoryCode: $code, limit: 5) { id status createdAt result }
    }
  }
`);

export const ExamsHubQuery = graphql(`
  query ExamsHub {
    blueprints { code name kind about verified itemCount sections spec }
    viewer { recordingConsent mockExams(limit: 10) { id kind status startedAt completedAt blueprintCode overallBand } }
  }
`);

export const ProgressQuery = graphql(`
  query Progress($days: Int!) {
    viewer {
      id
      demoMode
      coach { level recommendations readiness weekly todayPlan }
      analytics(days: $days)
    }
    practiceTypes: questionCategories { code name }
  }
`);

export const TutorQuery = graphql(`
  query Tutor {
    viewer {
      id
      demoMode
      profile { level { code name cefr } }
      tutorMessages(limit: 40) { id role content provider createdAt }
    }
  }
`);

export const RolesQuery = graphql(`
  query Roles {
    viewer { id roles }
  }
`);
