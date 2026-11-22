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
      recentAttempts(limit: 5) { id createdAt isCorrect scoreRatio category { code name } }
      recommendedLessons(limit: 3) { id slug title summary estimatedMinutes level { code cefr } }
      weakAreas { accuracy attempts category { code name } }
      mockExams(limit: 5) { id kind status startedAt completedAt }
    }
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
      profile { displayName targetScore examDate dailyGoalMinutes level { code name cefr } }
    }
  }
`);

export const LessonsQuery = graphql(`
  query Lessons {
    learningLevels { code name cefr }
    lessons {
      id slug title summary estimatedMinutes
      level { code }
      progress { status bestScore }
    }
  }
`);

export const LessonQuery = graphql(`
  query Lesson($slug: String!) {
    lesson(slug: $slug) {
      id slug title summary estimatedMinutes
      level { code name cefr }
      progress { status bestScore }
      sections { kind title bodyMd exercises { id type prompt options hint } }
    }
  }
`);
