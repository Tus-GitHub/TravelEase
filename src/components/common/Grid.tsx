/**
 * Responsive grid driven by a `cols` config. Column classes are resolved from a
 * static lookup (not string-built) so Tailwind's JIT always includes them.
 */

type ColCount = 1 | 2 | 3 | 4 | 5 | 6;

export interface GridCols {
  base?: ColCount;
  sm?: ColCount;
  md?: ColCount;
  lg?: ColCount;
  xl?: ColCount;
}

const baseCols: Record<ColCount, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
};
const smCols: Record<ColCount, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-5",
  6: "sm:grid-cols-6",
};
const mdCols: Record<ColCount, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
  6: "md:grid-cols-6",
};
const lgCols: Record<ColCount, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};
const xlCols: Record<ColCount, string> = {
  1: "xl:grid-cols-1",
  2: "xl:grid-cols-2",
  3: "xl:grid-cols-3",
  4: "xl:grid-cols-4",
  5: "xl:grid-cols-5",
  6: "xl:grid-cols-6",
};

export interface GridProps {
  cols?: GridCols;
  gap?: string;
  className?: string;
  children: React.ReactNode;
}

export default function Grid({
  cols = { base: 1, sm: 2, lg: 3 },
  gap = "gap-6 lg:gap-8",
  className = "",
  children,
}: GridProps) {
  const classes = [
    "grid",
    gap,
    cols.base && baseCols[cols.base],
    cols.sm && smCols[cols.sm],
    cols.md && mdCols[cols.md],
    cols.lg && lgCols[cols.lg],
    cols.xl && xlCols[cols.xl],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={classes}>{children}</div>;
}
