export function pointToOrientedRectDistance(point, rectangle) {
  const cosine = Math.cos(rectangle.yaw || 0);
  const sine = Math.sin(rectangle.yaw || 0);
  const dx = point.x - rectangle.x;
  const dz = point.z - rectangle.z;
  const localX = dx * cosine - dz * sine;
  const localZ = dx * sine + dz * cosine;
  const outsideX = Math.max(0, Math.abs(localX) - rectangle.width / 2);
  const outsideZ = Math.max(0, Math.abs(localZ) - rectangle.depth / 2);
  return Math.hypot(outsideX, outsideZ);
}

export function auditTrackClearance(routeSamples, items, vehicle) {
  const violations = [];
  const railRelative = Number.isFinite(vehicle.railOffsetMin)
    && Number.isFinite(vehicle.railOffsetMax);

  items.forEach((item) => {
    if (!railRelative && (item.minY > vehicle.maxY || item.maxY < vehicle.minY)) return;
    let clearance = Infinity;
    routeSamples.forEach((point) => {
      if (railRelative) {
        if (item.minY > point.y + vehicle.railOffsetMax) return;
        if (item.maxY < point.y + vehicle.railOffsetMin) return;
      }
      clearance = Math.min(clearance, pointToOrientedRectDistance(point, item));
    });
    if (clearance < vehicle.halfWidth) {
      violations.push({
        label: item.label,
        clearance,
        required: vehicle.halfWidth
      });
    }
  });

  return { checked: items.length, violations };
}
