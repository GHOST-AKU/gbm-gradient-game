(function registerKMeansModel(global) {
  function distance2(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  function assign(points, centroids) {
    return points.map((point) => {
      let best = 0;
      let bestDistance = Infinity;
      centroids.forEach((centroid, index) => {
        const value = distance2(point, centroid);
        if (value < bestDistance) {
          best = index;
          bestDistance = value;
        }
      });
      return best;
    });
  }

  function metrics(points, assignments, centroids, baseline, round) {
    const counts = Array(centroids.length).fill(0);
    let inertia = 0;
    points.forEach((point, index) => {
      const cluster = assignments[index];
      counts[cluster] += 1;
      inertia += distance2(point, centroids[cluster]);
    });
    inertia /= points.length;
    const empty = counts.filter((count) => count === 0).length;
    const movement = centroids.reduce((sum, centroid) => {
      const dx = centroid.x - centroid.lastX;
      const dy = centroid.y - centroid.lastY;
      return sum + Math.sqrt(dx * dx + dy * dy);
    }, 0);
    const compactness = Math.max(0, Math.min(1, 1 - inertia / baseline));
    const stability = round ? Math.max(0, Math.min(1, 1 - movement / Math.max(0.02, centroids.length * 0.2))) : 0;
    const score = Math.max(0, Math.min(0.99, compactness * 0.55 + stability * 0.39 + (empty ? 0 : 1) * 0.06 - empty * 0.08));
    return { inertia, empty, movement, score, stability, counts };
  }

  function step(points, centroids, rate) {
    const assignments = assign(points, centroids);
    const nextCentroids = centroids.map((centroid, index) => {
      const members = points.filter((_, pointIndex) => assignments[pointIndex] === index);
      if (!members.length) return { ...centroid, lastX: centroid.x, lastY: centroid.y };
      const meanX = members.reduce((sum, point) => sum + point.x, 0) / members.length;
      const meanY = members.reduce((sum, point) => sum + point.y, 0) / members.length;
      return {
        x: centroid.x + (meanX - centroid.x) * rate,
        y: centroid.y + (meanY - centroid.y) * rate,
        lastX: centroid.x,
        lastY: centroid.y,
      };
    });
    return { centroids: nextCentroids, assignments: assign(points, nextCentroids) };
  }

  global.KMeansModel = { assign, distance2, metrics, step };
})(typeof window === "undefined" ? globalThis : window);
