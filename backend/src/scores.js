import db from "./db.js";

export function computeScores(engagementId) {
  const themes = db.prepare("SELECT * FROM themes ORDER BY id").all();
  const subDims = db.prepare("SELECT * FROM sub_dimensions ORDER BY id").all();
  const questions = db.prepare("SELECT * FROM questions ORDER BY id").all();
  const responseRows = db.prepare(
    "SELECT * FROM responses WHERE engagement_id = ?"
  ).all(engagementId);

  const responseMap = {};
  for (const r of responseRows) {
    responseMap[r.question_id] = r;
  }

  const Q_WEIGHT = 0.25 / 5;

  const themeMap = {};
  for (const t of themes) themeMap[t.id] = t;

  const sdMap = {};
  for (const sd of subDims) sdMap[sd.id] = sd;

  // Group questions by sub-dimension
  const questionsBySD = {};
  for (const q of questions) {
    if (!questionsBySD[q.sub_dimension_id]) questionsBySD[q.sub_dimension_id] = [];
    questionsBySD[q.sub_dimension_id].push(q);
  }

  // Group sub-dims by theme
  const sdByTheme = {};
  for (const sd of subDims) {
    if (!sdByTheme[sd.theme_id]) sdByTheme[sd.theme_id] = [];
    sdByTheme[sd.theme_id].push(sd);
  }

  const subDimResults = [];
  const themeResults = [];

  for (const theme of themes) {
    const sds = sdByTheme[theme.id] || [];
    let themeCurrentWtSum = 0, themeTargetWtSum = 0, themeWtUsed = 0;

    for (const sd of sds) {
      const qs = questionsBySD[sd.id] || [];
      let sdCurrentSum = 0, sdTargetSum = 0, sdWtUsed = 0;

      for (const q of qs) {
        const r = responseMap[q.id];
        if (r && r.current_score !== null && r.current_score !== undefined) {
          sdCurrentSum += r.current_score * Q_WEIGHT;
          sdWtUsed += Q_WEIGHT;
        }
        if (r && r.target_score !== null && r.target_score !== undefined) {
          sdTargetSum += r.target_score * Q_WEIGHT;
        }
      }

      const avgCurrent = sdWtUsed > 0 ? sdCurrentSum / sdWtUsed : null;
      const avgTarget = sdWtUsed > 0 && sdTargetSum > 0 ? sdTargetSum / sdWtUsed : null;
      const gap = avgCurrent !== null && avgTarget !== null ? avgTarget - avgCurrent : null;
      const weightedGap = gap !== null ? gap * sd.weight * theme.weight : null;

      subDimResults.push({
        theme_id: theme.id,
        theme_name: theme.name,
        sub_dim_id: sd.id,
        sub_dim_name: sd.name,
        // Legacy fields for backward compat
        theme: theme.name,
        sub_dimension: sd.name,
        avg_current: avgCurrent !== null ? +avgCurrent.toFixed(3) : null,
        avg_target: avgTarget !== null ? +avgTarget.toFixed(3) : null,
        gap: gap !== null ? +gap.toFixed(3) : null,
        sub_dim_weight: sd.weight,
        theme_weight: theme.weight,
        weighted_gap: weightedGap !== null ? +weightedGap.toFixed(4) : null,
      });

      if (avgCurrent !== null) {
        themeCurrentWtSum += avgCurrent * (sd.weight * Q_WEIGHT * 5);
        themeWtUsed += sd.weight * Q_WEIGHT * 5;
      }
      if (avgTarget !== null) {
        themeTargetWtSum += avgTarget * (sd.weight * Q_WEIGHT * 5);
      }
    }

    const themeAvgCurrent = themeWtUsed > 0 ? themeCurrentWtSum / themeWtUsed : null;
    const themeAvgTarget = themeWtUsed > 0 && themeTargetWtSum > 0 ? themeTargetWtSum / themeWtUsed : null;
    const themeGap = themeAvgCurrent !== null && themeAvgTarget !== null ? themeAvgTarget - themeAvgCurrent : null;

    themeResults.push({
      theme_id: theme.id,
      theme_name: theme.name,
      // Legacy field
      theme: theme.name,
      avg_current: themeAvgCurrent !== null ? +themeAvgCurrent.toFixed(3) : null,
      avg_target: themeAvgTarget !== null ? +themeAvgTarget.toFixed(3) : null,
      gap: themeGap !== null ? +themeGap.toFixed(3) : null,
      weight: theme.weight,
      weighted_current: themeAvgCurrent !== null ? +(themeAvgCurrent * theme.weight).toFixed(4) : null,
      weighted_target: themeAvgTarget !== null ? +(themeAvgTarget * theme.weight).toFixed(4) : null,
      weighted_gap: themeGap !== null ? +(themeGap * theme.weight).toFixed(4) : null,
    });
  }

  const overallCurrent = themeResults.reduce((s, t) => s + (t.weighted_current ?? 0), 0);
  const overallTarget = themeResults.reduce((s, t) => s + (t.weighted_target ?? 0), 0);
  const overallGap = overallCurrent > 0 && overallTarget > 0 ? overallTarget - overallCurrent : null;

  const topGaps = [...subDimResults]
    .filter((s) => s.weighted_gap !== null)
    .sort((a, b) => b.weighted_gap - a.weighted_gap)
    .slice(0, 5);

  const answered = responseRows.filter((r) => r.current_score !== null).length;
  const total = questions.length;

  return {
    overall_current: +overallCurrent.toFixed(3),
    overall_target: +overallTarget.toFixed(3),
    overall_gap: overallGap !== null ? +overallGap.toFixed(3) : null,
    themes: themeResults,
    sub_dimensions: subDimResults,
    top_gaps: topGaps,
    progress: { answered, total },
  };
}
