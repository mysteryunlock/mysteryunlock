/**
 * Design System — barrel export
 *
 * Import everything from here:
 *   import { Btn, Card, Input, Badge, EmptyState } from "@/components/ds"
 */

// Button
export { Btn, btnVariants } from "./button";
export type { BtnProps } from "./button";

// Card
export { Card, cardVariants, KpiCard } from "./card";
export type { CardProps, KpiCardProps } from "./card";

// Input / Form
export { Label, Input, Textarea, Field, inputBase } from "./input";
export type { LabelProps, InputProps, TextareaProps, FieldProps } from "./input";

// Badge
export { Badge, badgeVariants, StatusBadge } from "./badge";
export type { BadgeProps } from "./badge";

// Empty State
export { EmptyState } from "./empty-state";
export type { EmptyStateProps } from "./empty-state";

// Skeleton / Loading
export {
  ShimmerBox,
  SkeletonBar,
  SkeletonBlock,
  SkeletonKpi,
  SkeletonRow,
  SkeletonCard,
  SkeletonAvatar,
  SkeletonKpiGrid,
  PageSkeleton,
} from "./skeleton";
export type { ShimmerBoxProps } from "./skeleton";

// Modal / Dialog
export { Modal, ConfirmModal } from "./modal";
export type { ModalProps, ConfirmModalProps } from "./modal";

// Segmented Control
export { SegmentedControl } from "./segmented-control";
export type { SegmentedControlProps, SegmentOption } from "./segmented-control";

// OTP Input
export { OtpInput } from "./otp-input";
export type { OtpInputProps } from "./otp-input";
