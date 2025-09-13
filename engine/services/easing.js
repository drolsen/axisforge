const { PI, sin, cos, pow } = Math;

function bounceOut(t) {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    t -= 1.5 / d1;
    return n1 * t * t + 0.75;
  } else if (t < 2.5 / d1) {
    t -= 2.25 / d1;
    return n1 * t * t + 0.9375;
  } else {
    t -= 2.625 / d1;
    return n1 * t * t + 0.984375;
  }
}

function elasticIn(t) {
  if (t === 0 || t === 1) return t;
  return -pow(2, 10 * t - 10) * sin((t * 10 - 10.75) * ((2 * PI) / 3));
}

function elasticOut(t) {
  if (t === 0 || t === 1) return t;
  return pow(2, -10 * t) * sin((t * 10 - 0.75) * ((2 * PI) / 3)) + 1;
}

function elasticInOut(t) {
  if (t === 0 || t === 1) return t;
  if (t < 0.5) {
    return -(pow(2, 20 * t - 10) * sin((20 * t - 11.125) * ((2 * PI) / 4.5))) / 2;
  }
  return (
    pow(2, -20 * t + 10) * sin((20 * t - 11.125) * ((2 * PI) / 4.5)) / 2 +
    1
  );
}

export function applyEasing(style = 'Linear', direction = 'In', t) {
  if (style === 'Bounce') {
    if (direction === 'In') return 1 - bounceOut(1 - t);
    if (direction === 'Out') return bounceOut(t);
    if (t < 0.5) {
      return (1 - bounceOut(1 - 2 * t)) / 2;
    }
    return (1 + bounceOut(2 * t - 1)) / 2;
  }

  if (style === 'Elastic') {
    if (direction === 'In') return elasticIn(t);
    if (direction === 'Out') return elasticOut(t);
    return elasticInOut(t);
  }

  const base = {
    Linear: v => v,
    Quad: v => v * v,
    Cubic: v => v * v * v,
    Quart: v => v * v * v * v,
    Quint: v => v * v * v * v * v,
    Sine: v => 1 - cos((v * PI) / 2),
    Expo: v => (v === 0 ? 0 : pow(2, 10 * v - 10)),
  }[style] || (v => v);

  if (direction === 'Out') {
    return 1 - base(1 - t);
  }
  if (direction === 'InOut') {
    if (t < 0.5) {
      return base(t * 2) / 2;
    }
    return 1 - base(2 - 2 * t) / 2;
  }
  return base(t);
}

