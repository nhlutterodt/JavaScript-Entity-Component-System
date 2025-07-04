# Advanced Animation System Design

This document describes the advanced features, architecture, and usage of the enhanced `AnimationSystem` for the JavaScript Entity Component System (ECS) project.

## Overview

The advanced `AnimationSystem` supports:
- Multiple concurrent animations per entity
- Animation blending and smooth transitions
- Animation queuing and sequencing
- Looping and pausing/resuming animations
- Event-driven animation lifecycle
- Extensible animation types and parameters

## Data Structures

### AnimationState
```js
{
  config: { ... },         // Animation configuration (type, duration, etc.)
  elapsed: number,         // Time elapsed for this animation
  startTime: number,       // Timestamp when started
  blendWeight: number,     // 0..1 for blending
  state: 'active' | 'queued' | 'blending' | 'paused' | 'completed',
  onComplete?: Function,   // Optional callback
  blendTarget?: AnimationState, // For blending transitions
  loopCount?: number,      // For looping
  maxLoops?: number,       // For looping
}
```

## API Methods

- `startAnimation(entityId, animationConfig, options = {})`
- `stopAnimation(entityId, animationTypeOrLayer)`
- `pauseAnimation(entityId, animationTypeOrLayer)`
- `resumeAnimation(entityId, animationTypeOrLayer)`
- `queueAnimation(entityId, animationConfig, options = {})`
- `getActiveAnimations(entityId)`
- `getAnimationState(entityId, animationTypeOrLayer)`

## Usage Examples

_TODO: Add usage examples after implementation._

## Events

- `animation:started`
- `animation:stopped`
- `animation:completed`
- `animation:blending`
- `animation:looped`

## Standards & Best Practices

- All classes use default export/import
- JSDoc for all public methods and classes
- Consistent file and directory naming
- Tests must match import/export patterns

---

_This document will be refined as the implementation progresses._
