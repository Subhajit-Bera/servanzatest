import React, { useEffect, useRef } from 'react';
import { View, Animated, ViewStyle } from 'react-native';
import { COLORS } from '../config/theme';

interface SkeletonProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * Pulse-animated skeleton placeholder.
 * Cycles opacity between 0.3 and 0.7 for a subtle loading shimmer.
 */
export const SkeletonBox: React.FC<SkeletonProps> = ({
  width,
  height,
  borderRadius = 8,
  style,
}) => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: COLORS.lightGray,
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
};

/** Circular skeleton (avatars) */
export const SkeletonCircle: React.FC<{ size: number; style?: ViewStyle }> = ({
  size,
  style,
}) => (
  <SkeletonBox
    width={size}
    height={size}
    borderRadius={size / 2}
    style={style}
  />
);

/** Text-line skeleton */
export const SkeletonText: React.FC<{
  width?: number | string;
  height?: number;
  style?: ViewStyle;
}> = ({ width = '100%', height = 14, style }) => (
  <SkeletonBox width={width} height={height} borderRadius={4} style={style} />
);

/** Container with vertical spacing */
export const SkeletonGroup: React.FC<{
  gap?: number;
  style?: ViewStyle;
  children: React.ReactNode;
}> = ({ gap = 12, style, children }) => (
  <View style={[{ gap }, style]}>{children}</View>
);

export default { SkeletonBox, SkeletonCircle, SkeletonText, SkeletonGroup };
