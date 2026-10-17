import { lazy } from "react";

// Route entry points load on demand; keep shared shell imports out of these modules.
export const ReadingWorkspace = lazy(
  () => import("../features/reading/ReadingWorkspace.jsx"),
);
export const Explore = lazy(() =>
  import("../features/explore/explore.jsx").then((module) => ({
    default: module.Explore,
  })),
);
export const ExerciseStudio = lazy(() =>
  import("../features/practice/exercise-studio.jsx").then((module) => ({
    default: module.ExerciseStudio,
  })),
);
export const PracticeGuide = lazy(() =>
  import("../features/practice/practice-guide.jsx").then((module) => ({
    default: module.PracticeGuide,
  })),
);
export const FlashcardStudio = lazy(
  () => import("../features/flashcards/flashcard-studio.jsx"),
);
export const PracticeHub = lazy(() =>
  import("../features/practice/practice-hub.jsx").then((module) => ({
    default: module.PracticeHub,
  })),
);
export const Admin = lazy(() => import("../features/admin/Admin.jsx"));
