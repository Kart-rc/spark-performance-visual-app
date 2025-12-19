# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an interactive Apache Spark performance tuning simulator built with React, TypeScript, and Vite. The app teaches Spark optimization concepts through guided missions where users adjust configuration "knobs" and see simulated performance impacts in real-time.

## Commands

### Development
```bash
npm run dev        # Start development server with HMR
npm run build      # Type-check with tsc and build for production
npm run preview    # Preview production build locally
npm run lint       # Run ESLint
```

### Environment Setup
The app uses Google Gemini AI for coaching assistance. Configure the API key:
1. Copy `.env` template if it doesn't exist
2. Set `VITE_GEMINI_API_KEY` in `.env` file
3. App falls back to mock responses if no valid API key is provided

## Architecture

### State Management (Zustand)
Central state is managed in `src/store/useSimStore.ts`:
- **Mission state**: Current mission, knobs (configuration toggles), and computed snapshot
- **Guide/Learning mode**: Multi-step guided tutorials with success validation
- **Gemini integration**: Chat history and typing state

The simulation runs synchronously via `simulate(missionId, knobs)` whenever knobs change, returning a new snapshot with stages, scorecard, plan diff, and animation data.

### Simulation Engine (`src/lib/simulation.ts`)
Core simulation logic that converts knob settings into performance metrics:
- `baselineStages()`: Returns mission-specific baseline stage metrics (duration, shuffle, spill, skew)
- `baselinePlan()`: Returns before/after physical plan strings for each mission
- `simulate()`: Main entry point that applies knob effects multiplicatively to baseline metrics
- Mission-specific logic blocks apply different transformations based on knob combinations
- Returns `Snapshot` object containing stages, scorecard, plan, and animation model

**Important patterns:**
- Knobs apply multiplicative scale factors to baseline metrics (e.g., `0.92` = 8% reduction)
- Mission-specific knobs are grouped together (e.g., MERGE-specific, join-specific)
- `fileImpactPct` tracks percentage of files touched (for file-focused missions like CDC merge, small files)
- Animation model switches between "shuffle" mode (partitions) and "files" mode based on mission type

### Mission System (`src/data/missions.ts`)
Defines 9 missions teaching different Spark optimization patterns:
1. **etl_joins**: Join-heavy ETL with broadcast optimization
2. **cdc_merge**: Delta MERGE with file overhead and deduplication
3. **skew_tail**: Data skew and long-tail task handling
4. **small_files**: Small file overhead and compaction (OPTIMIZE/ZORDER)
5. **cache_spill**: Cache memory pressure tradeoffs
6. **dpp_tuning**: Dynamic partition pruning
7. **udf_native**: Python UDF vs native functions
8. **wide_schema**: Column pruning for wide tables
9. **multi_join**: Multi-way join order optimization

Each mission includes:
- `baselineKnobs`: The "broken" starting point
- `initialKnobs`: Where the user actually starts (may have some fixes pre-applied)
- `coachSteps`: Array of guided learning steps with validation functions
- `slaMinutes`: Performance target for the mission

### Type System (`src/types/index.ts`)
Central type definitions:
- `Knobs`: All available configuration toggles (AQE, broadcast, caching, etc.)
- `StageMetric`: Performance metrics for a single Spark stage
- `Snapshot`: Complete simulation result (stages, scorecard, plan, animation)
- `Mission`: Mission definition with steps and validation
- `AnimationModel`: Visual representation data (partitions or files)

### Component Structure
- `src/App.tsx`: Root component with mission picker / workspace routing
- `src/components/dashboard/`: Main workspace UI components
  - `Workspace.tsx`: Main mission workspace layout with left/right panels
  - `KnobPanel.tsx`: Configuration controls (toggles and sliders)
  - `SparkUISim.tsx`: Stage metrics visualization (Recharts)
  - `DagPanel.tsx`: Scorecard display (runtime, cost, SLA risk)
  - `PlanDiff.tsx`: Physical plan comparison
  - `PartitionOrFileAnim.tsx`: Animated partition/file visualization
  - `LearningPanel.tsx`: Guided learning mode with step progression
  - `GeminiAssistant.tsx`: AI chat interface
- `src/components/ui/`: shadcn/ui component library

### Gemini Integration (`src/lib/gemini.ts`)
Provides AI-powered coaching assistance:
- Uses Google Gemini 1.5 Flash model when API key is configured
- Falls back to mock responses with pattern matching when no API key
- Context includes mission ID, current knobs, and snapshot statistics
- Mock responses cover common queries (analyze run, explain plan, define AQE/spill/skew)

## Development Guidelines

### Modifying Simulation Logic
When changing how knobs affect performance:
1. Locate the mission-specific block in `simulate()` function
2. Apply multiplicative factors to stage metrics (avoid setting absolute values)
3. Update `notes` array to explain the change to users
4. Test that scorecard calculations remain reasonable
5. Verify animation model updates correctly (shuffle vs file intensity)

### Adding New Knobs
1. Add knob to `Knobs` type in `src/types/index.ts`
2. Add default value in `defaultKnobs` in `src/data/missions.ts`
3. Implement effect in `simulate()` function (shared or mission-specific)
4. Add UI control in `src/components/dashboard/KnobPanel.tsx`
5. Update relevant mission `coachSteps` if needed

### Adding New Missions
1. Add mission ID to `MissionId` union type
2. Create mission object in `missions` record
3. Implement `baselineStages()` case with realistic metrics
4. Implement `baselinePlan()` case with before/after plan strings
5. Add mission-specific simulation logic in `simulate()`
6. Design `coachSteps` with clear validation functions

### Mission Step Validation
Each `CoachStep` has a `success()` function that receives `(snapshot, knobs)`:
- Return `true` when the step's goal is achieved
- Use concrete checks (e.g., `knobs.aqe === true` or `snap.scorecard.runtimeMin < 30`)
- Avoid vague conditions; users need clear feedback

### Styling
- Uses Tailwind CSS with custom theme configuration in `tailwind.config.js`
- Dark mode support via CSS variables
- Component variants managed with `class-variance-authority`
- Animations via `framer-motion` for page transitions and visual effects

## Key Constraints

- Simulation is **client-side only** - no backend, all calculations in browser
- State updates trigger immediate re-simulation (performance is critical)
- Plan diff highlights are static strings; keep them concise for UI clarity
- File animation is limited to ~60 files max for performance
- Gemini API calls are async; UI shows typing indicator during requests
