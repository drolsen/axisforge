export default class SplatRules {
  constructor(rules = []) {
    this.rules = rules;
  }

  // Evaluate rules based on height and slope thresholds
  evaluate(height, slope) {
    for (const rule of this.rules) {
      const h = rule.height || [-Infinity, Infinity];
      const s = rule.slope || [-Infinity, Infinity];
      if (height >= h[0] && height <= h[1] && slope >= s[0] && slope <= s[1]) {
        return rule;
      }
    }
    return null;
  }

  // Serialize rules to JSON string
  serialize() {
    return JSON.stringify(this.rules);
  }

  // Deserialize from JSON string
  static deserialize(json) {
    try {
      const rules = JSON.parse(json);
      return new SplatRules(rules);
    } catch (e) {
      return new SplatRules();
    }
  }
}
