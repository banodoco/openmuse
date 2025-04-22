import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-neutral-200/30 dark:bg-neutral-800/30", className)}
      {...props}
    />
  )
}

export { Skeleton }
