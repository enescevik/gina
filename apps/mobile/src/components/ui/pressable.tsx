import { forwardRef, useState, type ComponentRef } from 'react';
import { Pressable as NativePressable, type PressableProps } from 'react-native';

/** Resolve render styles before NativeWind's native style cascade sees them.
 * Its native inline-style collector does not evaluate Pressable style callbacks.
 * Passing a plain style also keeps web and native sizing/contrast identical.
 */
export const Pressable = forwardRef<ComponentRef<typeof NativePressable>, PressableProps>(function Pressable(
  { style, children, onPressIn, onPressOut, onHoverIn, onHoverOut, disabled, ...props }, ref,
) {
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const state = { pressed: pressed && !disabled, hovered };
  return <NativePressable {...props} ref={ref} disabled={disabled}
    onPressIn={event => { setPressed(true); onPressIn?.(event); }}
    onPressOut={event => { setPressed(false); onPressOut?.(event); }}
    onHoverIn={event => { setHovered(true); onHoverIn?.(event); }}
    onHoverOut={event => { setHovered(false); onHoverOut?.(event); }}
    style={typeof style === 'function' ? style(state) : style}>
    {typeof children === 'function' ? children(state) : children}
  </NativePressable>;
});
