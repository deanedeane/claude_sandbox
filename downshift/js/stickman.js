/**
 * Stickman Visualizer Module
 * Renders simple stick figure poses using SVG
 */

const Stickman = (() => {
  const COLOR = '#D4AF37'; // Amber color
  const STROKE_WIDTH = 3;

  // Pose library - predefined stick figure positions
  const POSES = {
    // Supine (lying on back)
    'supine': {
      head: { cx: 100, cy: 50, r: 15 },
      torso: { x1: 100, y1: 65, x2: 100, y2: 130 },
      leftArm: { x1: 100, y1: 80, x2: 70, y2: 100 },
      rightArm: { x1: 100, y1: 80, x2: 130, y2: 100 },
      leftLeg: { x1: 100, y1: 130, x2: 80, y2: 180 },
      rightLeg: { x1: 100, y1: 130, x2: 120, y2: 180 }
    },

    // Prone (lying face down)
    'prone': {
      head: { cx: 100, cy: 50, r: 15 },
      torso: { x1: 100, y1: 65, x2: 100, y2: 130 },
      leftArm: { x1: 100, y1: 80, x2: 60, y2: 70 },
      rightArm: { x1: 100, y1: 80, x2: 140, y2: 70 },
      leftLeg: { x1: 100, y1: 130, x2: 90, y2: 180 },
      rightLeg: { x1: 100, y1: 130, x2: 110, y2: 180 }
    },

    // Quadruped (on hands and knees)
    'quadruped': {
      head: { cx: 100, cy: 60, r: 15 },
      torso: { x1: 100, y1: 75, x2: 100, y2: 120 },
      leftArm: { x1: 100, y1: 80, x2: 70, y2: 130 },
      rightArm: { x1: 100, y1: 80, x2: 130, y2: 130 },
      leftLeg: { x1: 100, y1: 120, x2: 75, y2: 170 },
      rightLeg: { x1: 100, y1: 120, x2: 125, y2: 170 }
    },

    // Child's pose (kneeling forward fold)
    'childs-pose': {
      head: { cx: 100, cy: 140, r: 15 },
      torso: { x1: 100, y1: 120, x2: 100, y2: 90 },
      leftArm: { x1: 100, y1: 90, x2: 60, y2: 140 },
      rightArm: { x1: 100, y1: 90, x2: 140, y2: 140 },
      leftLeg: { x1: 100, y1: 120, x2: 85, y2: 160 },
      rightLeg: { x1: 100, y1: 120, x2: 115, y2: 160 }
    },

    // Seated
    'seated': {
      head: { cx: 100, cy: 50, r: 15 },
      torso: { x1: 100, y1: 65, x2: 100, y2: 120 },
      leftArm: { x1: 100, y1: 80, x2: 75, y2: 115 },
      rightArm: { x1: 100, y1: 80, x2: 125, y2: 115 },
      leftLeg: { x1: 100, y1: 120, x2: 70, y2: 160 },
      rightLeg: { x1: 100, y1: 120, x2: 130, y2: 160 }
    },

    // Standing
    'standing': {
      head: { cx: 100, cy: 30, r: 15 },
      torso: { x1: 100, y1: 45, x2: 100, y2: 110 },
      leftArm: { x1: 100, y1: 55, x2: 70, y2: 90 },
      rightArm: { x1: 100, y1: 55, x2: 130, y2: 90 },
      leftLeg: { x1: 100, y1: 110, x2: 85, y2: 180 },
      rightLeg: { x1: 100, y1: 110, x2: 115, y2: 180 }
    },

    // Side-lying
    'side-lying': {
      head: { cx: 60, cy: 100, r: 15 },
      torso: { x1: 75, y1: 100, x2: 120, y2: 100 },
      leftArm: { x1: 85, y1: 100, x2: 75, y2: 70 },
      rightArm: { x1: 85, y1: 100, x2: 90, y2: 125 },
      leftLeg: { x1: 120, y1: 100, x2: 150, y2: 90 },
      rightLeg: { x1: 120, y1: 100, x2: 150, y2: 110 }
    },

    // Forward fold
    'forward-fold': {
      head: { cx: 100, cy: 120, r: 15 },
      torso: { x1: 100, y1: 100, x2: 100, y2: 50 },
      leftArm: { x1: 100, y1: 60, x2: 90, y2: 130 },
      rightArm: { x1: 100, y1: 60, x2: 110, y2: 130 },
      leftLeg: { x1: 100, y1: 100, x2: 85, y2: 180 },
      rightLeg: { x1: 100, y1: 100, x2: 115, y2: 180 }
    },

    // Twist
    'twist': {
      head: { cx: 95, cy: 50, r: 15 },
      torso: { x1: 100, y1: 65, x2: 100, y2: 120 },
      leftArm: { x1: 100, y1: 75, x2: 60, y2: 80 },
      rightArm: { x1: 100, y1: 75, x2: 125, y2: 110 },
      leftLeg: { x1: 100, y1: 120, x2: 75, y2: 170 },
      rightLeg: { x1: 100, y1: 120, x2: 120, y2: 165 }
    },

    // Legs up
    'legs-up': {
      head: { cx: 100, cy: 140, r: 15 },
      torso: { x1: 100, y1: 125, x2: 100, y2: 80 },
      leftArm: { x1: 100, y1: 95, x2: 70, y2: 110 },
      rightArm: { x1: 100, y1: 95, x2: 130, y2: 110 },
      leftLeg: { x1: 100, y1: 80, x2: 90, y2: 30 },
      rightLeg: { x1: 100, y1: 80, x2: 110, y2: 30 }
    }
  };

  /**
   * Render a stick figure based on pose description
   */
  const render = (poseDescription, svgElement) => {
    // Parse pose description and find closest match
    const poseKey = findClosestPose(poseDescription);
    const pose = POSES[poseKey] || POSES['standing'];

    // Clear existing content
    svgElement.innerHTML = '';

    // Draw stick figure
    drawStickFigure(svgElement, pose);
  };

  /**
   * Find closest matching pose from description
   */
  const findClosestPose = (description) => {
    const desc = description.toLowerCase();

    // Direct matches
    if (desc.includes('child') || desc.includes('kneeling forward')) return 'childs-pose';
    if (desc.includes('supine') || desc.includes('lying on back') || desc.includes('happy baby')) return 'supine';
    if (desc.includes('prone') || desc.includes('lying face down') || desc.includes('seal')) return 'prone';
    if (desc.includes('quadruped') || desc.includes('hands and knees') || desc.includes('cat') || desc.includes('cow')) return 'quadruped';
    if (desc.includes('seated') || desc.includes('sitting')) return 'seated';
    if (desc.includes('standing') || desc.includes('upright')) return 'standing';
    if (desc.includes('side-lying') || desc.includes('side lying') || desc.includes('thread')) return 'side-lying';
    if (desc.includes('forward fold') || desc.includes('forward bend') || desc.includes('fold')) return 'forward-fold';
    if (desc.includes('twist') || desc.includes('rotation')) return 'twist';
    if (desc.includes('legs up') || desc.includes('inverted') || desc.includes('legs-up')) return 'legs-up';

    // Default to standing
    return 'standing';
  };

  /**
   * Draw stick figure from pose data
   */
  const drawStickFigure = (svg, pose) => {
    // Draw torso
    drawLine(svg, pose.torso);

    // Draw arms
    drawLine(svg, pose.leftArm);
    drawLine(svg, pose.rightArm);

    // Draw legs
    drawLine(svg, pose.leftLeg);
    drawLine(svg, pose.rightLeg);

    // Draw head (last so it's on top)
    drawCircle(svg, pose.head);

    // Add subtle glow effect
    addGlow(svg);
  };

  /**
   * Draw a line
   */
  const drawLine = (svg, { x1, y1, x2, y2 }) => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', COLOR);
    line.setAttribute('stroke-width', STROKE_WIDTH);
    line.setAttribute('stroke-linecap', 'round');
    svg.appendChild(line);
  };

  /**
   * Draw a circle
   */
  const drawCircle = (svg, { cx, cy, r }) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', r);
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', COLOR);
    circle.setAttribute('stroke-width', STROKE_WIDTH);
    svg.appendChild(circle);
  };

  /**
   * Add glow filter
   */
  const addGlow = (svg) => {
    // Define filter
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', 'glow');

    const feGaussianBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
    feGaussianBlur.setAttribute('stdDeviation', '2');
    feGaussianBlur.setAttribute('result', 'coloredBlur');

    const feMerge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
    const feMergeNode1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    feMergeNode1.setAttribute('in', 'coloredBlur');
    const feMergeNode2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    feMergeNode2.setAttribute('in', 'SourceGraphic');

    feMerge.appendChild(feMergeNode1);
    feMerge.appendChild(feMergeNode2);
    filter.appendChild(feGaussianBlur);
    filter.appendChild(feMerge);
    defs.appendChild(filter);
    svg.insertBefore(defs, svg.firstChild);

    // Apply filter to all elements
    svg.querySelectorAll('line, circle').forEach(el => {
      el.setAttribute('filter', 'url(#glow)');
    });
  };

  /**
   * Get list of available poses
   */
  const getAvailablePoses = () => {
    return Object.keys(POSES);
  };

  // Public API
  return {
    render,
    getAvailablePoses
  };
})();
