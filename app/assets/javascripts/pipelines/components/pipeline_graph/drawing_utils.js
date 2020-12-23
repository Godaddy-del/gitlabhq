import * as d3 from 'd3';
import { createUniqueLinkId } from '../../utils';
/**
 * This function expects its first argument data structure
 * to be the same shaped as the one generated by `parseData`,
 * which contains nodes and links. For each link,
 * we find the nodes in the graph, calculate their coordinates and
 * trace the lines that represent the needs of each job.
 * @param {Object} nodeDict - Resulting object of `parseData` with nodes and links
 * @param {Object} jobs - An object where each key is the job name that contains the job data
 * @param {ref} svg - Reference to the svg we draw in
 * @returns {Array} Links that contain all the information about them
 */

export const generateLinksData = ({ links }, containerID) => {
  const containerEl = document.getElementById(containerID);
  return links.map(link => {
    const path = d3.path();

    const sourceId = link.source;
    const targetId = link.target;

    const sourceNodeEl = document.getElementById(sourceId);
    const targetNodeEl = document.getElementById(targetId);

    const sourceNodeCoordinates = sourceNodeEl.getBoundingClientRect();
    const targetNodeCoordinates = targetNodeEl.getBoundingClientRect();
    const containerCoordinates = containerEl.getBoundingClientRect();

    // Because we add the svg dynamically and calculate the coordinates
    // with plain JS and not D3, we need to account for the fact that
    // the coordinates we are getting are absolutes, but we want to draw
    // relative to the svg container, which starts at `containerCoordinates(x,y)`
    // so we substract these from the total. We also need to remove the padding
    // from the total to make sure it's aligned properly. We then make the line
    // positioned in the center of the job node by adding half the height
    // of the job pill.
    const paddingLeft = Number(
      window.getComputedStyle(containerEl, null).getPropertyValue('padding-left').replace('px', ''),
    );
    const paddingTop = Number(
      window.getComputedStyle(containerEl, null).getPropertyValue('padding-top').replace('px', ''),
    );

    const sourceNodeX = sourceNodeCoordinates.right - containerCoordinates.x - paddingLeft;
    const sourceNodeY =
      sourceNodeCoordinates.top -
      containerCoordinates.y -
      paddingTop +
      sourceNodeCoordinates.height / 2;
    const targetNodeX = targetNodeCoordinates.x - containerCoordinates.x - paddingLeft;
    const targetNodeY =
      targetNodeCoordinates.y -
      containerCoordinates.y -
      paddingTop +
      sourceNodeCoordinates.height / 2;

    // Start point
    path.moveTo(sourceNodeX, sourceNodeY);

    // Make cross-stages lines a straight line all the way
    // until we can safely draw the bezier to look nice.
    const straightLineDestinationX = targetNodeX - 100;
    const controlPointX = straightLineDestinationX + (targetNodeX - straightLineDestinationX) / 2;

    if (straightLineDestinationX > 0) {
      path.lineTo(straightLineDestinationX, sourceNodeY);
    }

    // Add bezier curve. The first 4 coordinates are the 2 control
    // points to create the curve, and the last one is the end point (x, y).
    // We want our control points to be in the middle of the line
    path.bezierCurveTo(
      controlPointX,
      sourceNodeY,
      controlPointX,
      targetNodeY,
      targetNodeX,
      targetNodeY,
    );

    return {
      ...link,
      source: sourceId,
      target: targetId,
      ref: createUniqueLinkId(sourceId, targetId),
      path: path.toString(),
    };
  });
};
