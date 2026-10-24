package timeline

import (
	"time"

	"agentbox/internal/api"
)

// A lane is a timeline drawn as one row of Mission control's day: no titles
// or lines, only what kind of thing the agent did when. At a day's width a
// minute is under a pixel, so steps of one kind close together are one
// segment, and a lane never has more than MaxSegments, however busy its day.

// MaxSegments is the most segments a lane has.
const MaxSegments = 240

// laneGap is how far apart two steps of one kind can be and still be one
// segment: the time between tool calls, not a pause.
const laneGap = 2 * time.Minute

// Lane is tl's steps from since on, as segments. A step that began before
// since and ended after it is cut at since.
func Lane(tl api.Timeline, since time.Time) []api.MissionSegment {
	segs := []api.MissionSegment{}
	for _, s := range tl.Steps {
		end := s.End
		if end.Before(s.Start) {
			end = s.Start
		}
		if end.Before(since) {
			continue
		}
		start := s.Start
		if start.Before(since) {
			start = since
		}
		segs = append(segs, api.MissionSegment{Kind: s.Kind, Start: start, End: end, Steps: 1, Status: segStatus(s.Status)})
	}
	segs = joinLane(segs, laneGap, false)
	// Too many to draw: join what lies close, whatever its kind, at gaps
	// doubling until they fit. The kind of the longest wins.
	for gap := laneGap; len(segs) > MaxSegments; gap *= 2 {
		segs = joinLane(segs, gap, true)
	}
	return segs
}

// joinLane joins neighbouring segments less than gap apart: only of one
// kind, unless anyKind.
func joinLane(segs []api.MissionSegment, gap time.Duration, anyKind bool) []api.MissionSegment {
	out := segs[:0:0]
	for _, s := range segs {
		if n := len(out); n > 0 {
			last := &out[n-1]
			if (anyKind || last.Kind == s.Kind) && s.Start.Sub(last.End) < gap {
				if s.End.Sub(s.Start) > last.End.Sub(last.Start) {
					last.Kind = s.Kind
				}
				last.End = later(last.End, s.End)
				last.Steps += s.Steps
				if s.Status == "running" || last.Status != "failed" {
					last.Status = s.Status
				}
				continue
			}
		}
		out = append(out, s)
	}
	return out
}

// segStatus is what a step's status says in a lane: failed and running
// show, passed is the same as nothing.
func segStatus(status string) string {
	if status == "failed" || status == "running" {
		return status
	}
	return ""
}
