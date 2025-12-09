import { Grid as MuiGrid, GridProps as MuiGridProps } from "@mui/material";
import { forwardRef } from "react";

export type GridProps = MuiGridProps;

/**
 * Grid container component
 */
export const Grid = forwardRef<HTMLDivElement, GridProps>((props, ref) => {
  return <MuiGrid ref={ref} {...props} />;
});

Grid.displayName = "Grid";

export default Grid;
