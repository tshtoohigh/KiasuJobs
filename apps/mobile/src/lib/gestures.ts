/**
 * Single point of contact with react-native-gesture-handler.
 *
 * Gesture Handler 3 replaced the v2 builder API (`Gesture.Pan().onUpdate(...)`)
 * with hooks that take a config object, and renamed the lifecycle callbacks:
 *
 *   v2                          v3
 *   Gesture.Pan()               usePanGesture({ ... })
 *   Gesture.Tap()               useTapGesture({ ... })
 *   .onStart(cb)                onActivate
 *   .onEnd(cb)                  onDeactivate
 *   .onEnd((e, success) => …)   onDeactivate((e) => …) with `e.canceled`
 *                               (note: canceled is the inverse of success)
 *
 * Everything else in the app imports from here, so if you end up on a
 * different RNGH major this file is the only one that needs touching.
 */
export {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
  useTapGesture,
} from 'react-native-gesture-handler';

export type { PanGestureEvent } from 'react-native-gesture-handler';
