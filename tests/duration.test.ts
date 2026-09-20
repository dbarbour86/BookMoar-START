import { describe, it, expect } from "vitest";
import {
  formatDuration,
  splitDurationMinutes,
  combineDurationMinutes,
} from "@/lib/duration";

describe("Duration Helpers", () => {
  describe("combineDurationMinutes", () => {
    it("converts hours and minutes to integer minutes", () => {
      expect(combineDurationMinutes(5, 0)).toBe(300);
      expect(combineDurationMinutes(1, 30)).toBe(90);
      expect(combineDurationMinutes(0, 45)).toBe(45);
      expect(combineDurationMinutes(2, 15)).toBe(135);
      expect(combineDurationMinutes(0, 0)).toBe(0);
    });

    it("handles string or irregular numbers safely", () => {
      expect(combineDurationMinutes("3", "15")).toBe(195);
      expect(combineDurationMinutes(-1, -5)).toBe(0);
    });
  });

  describe("splitDurationMinutes", () => {
    it("splits standard durations into hours and minutes", () => {
      expect(splitDurationMinutes(30)).toEqual({ hours: 0, minutes: 30 });
      expect(splitDurationMinutes(60)).toEqual({ hours: 1, minutes: 0 });
      expect(splitDurationMinutes(90)).toEqual({ hours: 1, minutes: 30 });
      expect(splitDurationMinutes(135)).toEqual({ hours: 2, minutes: 15 });
      expect(splitDurationMinutes(300)).toEqual({ hours: 5, minutes: 0 });
    });

    it("handles 0 duration", () => {
      expect(splitDurationMinutes(0)).toEqual({ hours: 0, minutes: 0 });
    });

    it("snaps irregular durations to closest 15-minute increment", () => {
      // 70 minutes is closest to 75 (1 hr 15 min)
      expect(splitDurationMinutes(70)).toEqual({ hours: 1, minutes: 15 });
      // 55 minutes is closest to 60 (1 hr 0 min)
      expect(splitDurationMinutes(55)).toEqual({ hours: 1, minutes: 0 });
      // 10 minutes is closest to 15 (0 hr 15 min)
      expect(splitDurationMinutes(10)).toEqual({ hours: 0, minutes: 15 });
    });
  });

  describe("formatDuration", () => {
    it("formats human-readable duration strings", () => {
      expect(formatDuration(30)).toBe("30 min");
      expect(formatDuration(60)).toBe("1 hr");
      expect(formatDuration(90)).toBe("1 hr 30 min");
      expect(formatDuration(135)).toBe("2 hr 15 min");
      expect(formatDuration(300)).toBe("5 hr");
      expect(formatDuration(0)).toBe("0 min");
      expect(formatDuration(45)).toBe("45 min");
      expect(formatDuration(120)).toBe("2 hr");
    });
  });
});
