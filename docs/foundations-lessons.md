# Foundations Course: First Four Lessons

These four lessons are the reference implementation for FemmeVoice Academy content. They are deliberately small, private by default, and written for someone who may be nervous, tired, dysphoric, or entirely new to voice learning.

## Lesson Set

| Lesson | Time | Purpose | Core blocks |
| --- | ---: | --- | --- |
| Welcome to FemmeVoice | 8 min | Choose a self-directed starting point and understand the app's limits. | Rich text, reflection, evidence panel, checkpoint |
| Safety, privacy, and pause | 9 min | Establish comfort, symptom, recording, and privacy boundaries. | Rich text, quiz, reading, checkpoint |
| How voice learning works | 10 min | Introduce a small, non-clinical map of voice without reducing it to pitch. | Rich text, illustration, listening activity, placeholder audio, evidence panel |
| First listening and gentle exploration | 12 min | Try one optional, low-pressure sound route and return to an ordinary phrase. | Rich text, interactive activity, reading, conversation prompt, reflection, checkpoint |

The next eight course-map items remain unavailable until their evidence, accessibility assets, and content review are complete.

## Content Rules Demonstrated Here

- Every lesson has a purpose, expected time, safety boundary, lower-intensity route, evidence references, and a leave-well checkpoint.
- Participation is the only completion requirement. A quiz needs an answer, not a correct answer; no block needs a recording, target note, or gender judgment.
- Audio remains a labelled placeholder until a reviewed asset and transcript are supplied. It is not a silent broken media control.
- The pathway illustration is an orientation aid, not a medical anatomy assessment. Its caption and alternative text explain the same limits.
- Lessons use the source library in the [Research and Practice Guide](research-guide.md). The structured lesson data records evidence level, citation, limitation, review date, reviewer role, and conflict-of-interest field beside each claim.

## Asset Replacement

`public/academy/voice-pathway.jpg` is a generated, simplified orientation illustration. Replace it only with an asset that keeps the plain-language caption and detailed alternative text current. The placeholder audio block can receive a reviewed `src` later without changing the lesson schema; its transcript is already required by validation.

## Authoring Observations

The versioned schema worked without a new block type. Two content conventions should remain explicit for future authors:

1. Put learner-facing completion language in `metadata.completionMessage`, so the generic player does not need course-specific copy.
2. Treat `metadata.programId`, `pathIds`, and `unitId` as required editorial fields once server authoring exists, even though the early static validator permits them to be null for generic fixtures.
3. Declare every renderer-required value in `content` (for example, `content.prompt` for reflections and quizzes). The schema now rejects a missing required value before it can create a blank, blocked step in a live lesson.
