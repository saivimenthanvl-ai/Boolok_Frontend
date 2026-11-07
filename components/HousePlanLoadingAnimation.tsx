/**
 * HouseDesignLoader / HousePlanLoadingAnimation
 * ---------------------------------------------------------------------------
 * React Native recreation of the 12-second "BOOLOK · AI Architect" progress
 * animation (brief → plot → floor plan → details → 3D cube → ready card).
 *
 * Supports:
 * - Dynamic Light & Dark themes
 * - Responsive auto-scaling for Laptop / Desktop and Mobile view (never cropped)
 * - Master clock Animated.Value (0 → 12s)
 */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Circle, G, Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

/* ───────────────────────── tokens ───────────────────────── */

const LIGHT_COLORS = {
  bg: '#F6F4F0',
  grid: '#ECEAE2',
  frame: '#E7E5DF',
  card: '#FDFDF8',
  cardBorder: '#ECE8CE',
  ink: '#232C2D',
  sub: '#72746F',
  mute: '#8A8D86',
  amber: '#CF8212',
  amberSoft: '#E9C46A',
  wall: '#1F2A2B',
  dim: '#9A9E96',
  track: '#E6E3D8',
  green: '#22A06B',
  roof: '#F5F3EC',
  wallL: '#E6E3D9',
  wallR: '#F8F4EE',
  floor: '#EFE9DF',
  ground: '#ECE9DB',
  glass: '#A9C7CC',
  door: '#BF8F48',
  edge: '#566261',
  roofLines: '#E3A83B',
  outerBg: '#F1EFEA',
};

const DARK_COLORS = {
  bg: '#0A0F1D',
  grid: '#151E32',
  frame: '#1E293D',
  card: '#111827',
  cardBorder: '#273449',
  ink: '#F8FAFC',
  sub: '#94A3B8',
  mute: '#64748B',
  amber: '#F59E0B',
  amberSoft: '#FBBF24',
  wall: '#E2E8F0',
  dim: '#64748B',
  track: '#1E293B',
  green: '#10B981',
  roof: '#1E293B',
  wallL: '#182234',
  wallR: '#222F46',
  floor: '#161F2E',
  ground: '#0D1424',
  glass: '#38BDF8',
  door: '#D97706',
  edge: '#64748B',
  roofLines: '#F59E0B',
  outerBg: '#060A14',
};

type ColorTokens = typeof LIGHT_COLORS;
const ThemeTokensContext = createContext<ColorTokens>(LIGHT_COLORS);
const useTokens = () => useContext(ThemeTokensContext);

const VB_W = 480;
const VB_H = 848;
const DURATION_S = 12; // length of the original clip

const STAGES = [
  { at: 0, title: 'Understanding your brief', sub: 'Gathering your requirements' },
  { at: 1.5, title: 'Mapping your plot', sub: 'Establishing the buildable area' },
  { at: 3.2, title: 'Drawing your floor plan', sub: 'Placing rooms with purpose' },
  { at: 6.1, title: 'Adding the details', sub: 'Refining spaces and circulation' },
  { at: 8.0, title: 'Bringing it to life', sub: 'Building a 3D preview' },
  { at: 10.2, title: 'Final touches', sub: 'Preparing your design preview' },
  { at: 11.4, title: 'Your home starts here', sub: 'Design preview ready' },
];

const stageAt = (t: number) => {
  let i = 0;
  for (let k = 0; k < STAGES.length; k++) if (t >= STAGES[k].at) i = k;
  return i;
};

// title/subtitle dip to 0 opacity for ~0.2s around each stage change
const DIP_IN: number[] = [0];
const DIP_OUT: number[] = [1];
STAGES.slice(1).forEach((s) => {
  DIP_IN.push(s.at - 0.1, s.at, s.at + 0.1);
  DIP_OUT.push(1, 0, 1);
});

const READY_AT = 11.55;

/* ───────────────────────── animation helpers ───────────────────────── */

type Clock = Animated.Value;
type Anim = Animated.Value | Animated.AnimatedInterpolation<number>;

const AG = Animated.createAnimatedComponent(G);
const ALine = Animated.createAnimatedComponent(Line);
const ARect = Animated.createAnimatedComponent(Rect);
const APolygon = Animated.createAnimatedComponent(Polygon);
const APath = Animated.createAnimatedComponent(Path);

/** 0 → 1 between time a and b (clamped) */
const seg = (clk: Clock, a: number, b: number, easing: (t: number) => number = Easing.linear) =>
  clk.interpolate({ inputRange: [a, b], outputRange: [0, 1], easing, extrapolate: 'clamp' });

/** piecewise-linear curve over time */
const keys = (clk: Clock, input: number[], output: number[]) =>
  clk.interpolate({ inputRange: input, outputRange: output, extrapolate: 'clamp' });

/** map a 0 → 1 progress onto a number range */
const lerp = (p: Anim, a: number, b: number) =>
  p.interpolate({ inputRange: [0, 1], outputRange: [a, b] });

const P = (pts: number[][]) => pts.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
const shiftY = (pts: number[][], dy: number) => pts.map((p) => [p[0], p[1] + dy]);

/** re-render only when a derived value changes (stage index, percent, ready flag…) */
function useClockSelect<T>(clk: Clock, select: (t: number) => T): T {
  const [v, setV] = useState<T>(() => select(0));
  useEffect(() => {
    const id = clk.addListener(({ value }) => {
      const n = select(value);
      setV((p) => (p === n ? p : n));
    });
    return () => clk.removeListener(id);
  }, [clk]);
  return v;
}

/** A line that "draws itself" from (x1,y1) to (x2,y2) between t0 and t1 */
function Draw(props: {
  clk: Clock;
  t0: number;
  t1: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  w: number;
  cap?: 'round' | 'butt' | 'square';
}) {
  const { clk, t0, t1, x1, y1, x2, y2, color, w, cap = 'round' } = props;
  const p = useMemo(() => seg(clk, t0, t1), [clk, t0, t1]);
  const show = useMemo(
    () => p.interpolate({ inputRange: [0, 0.001, 1], outputRange: [0, 1, 1] }),
    [p],
  );
  return (
    <ALine
      x1={x1}
      y1={y1}
      x2={lerp(p, x1, x2) as any}
      y2={lerp(p, y1, y2) as any}
      stroke={color}
      strokeWidth={w}
      strokeLinecap={cap}
      opacity={show as any}
    />
  );
}

/** simple fade-in between a and b */
function Fade({ clk, a, b, children }: { clk: Clock; a: number; b: number; children: React.ReactNode }) {
  const o = useMemo(() => seg(clk, a, b), [clk, a, b]);
  return <AG opacity={o as any}>{children}</AG>;
}

/* ───────────────────────── live text pieces ───────────────────────── */

function StageTitle({ clk }: { clk: Clock }) {
  const C = useTokens();
  const idx = useClockSelect(clk, stageAt);
  const o = useMemo(() => keys(clk, DIP_IN, DIP_OUT), [clk]);
  return (
    <AG opacity={o as any}>
      <SvgText x={32} y={118} fontSize={27} fontWeight="700" fill={C.ink}>
        {STAGES[idx].title}
      </SvgText>
      <SvgText x={33} y={141} fontSize={14.5} letterSpacing={0.3} fill={C.sub}>
        {STAGES[idx].sub}
      </SvgText>
    </AG>
  );
}

function PercentLabel({ clk }: { clk: Clock }) {
  const C = useTokens();
  const pct = useClockSelect(clk, (t) => Math.min(100, Math.floor((t / DURATION_S) * 100)));
  return (
    <SvgText x={410} y={771} fontSize={8} textAnchor="end" letterSpacing={0.5} fill={C.amber}>
      {String(pct).padStart(2, '0')}%
    </SvgText>
  );
}

/* ───────────────────────── scene 1 · the brief (0 – 1.5s) ───────────────────────── */

function BriefScene({ clk, formData }: { clk: Clock; formData?: any }) {
  const C = useTokens();
  const vis = useMemo(() => keys(clk, [0, 0.2, 1.4, 1.55], [0, 1, 1, 0]), [clk]);

  const briefRows = useMemo(() => {
    if (!formData) {
      return ['3 bedrooms', 'East-facing plot', 'Modern, open-plan living', 'Garden + car parking'];
    }
    const beds = formData.bedrooms ? `${formData.bedrooms} bedrooms` : '3 bedrooms';
    const facing = formData.facing
      ? `${formData.facing.charAt(0).toUpperCase() + formData.facing.slice(1)}-facing plot`
      : 'East-facing plot';
    const style = formData.archStyle
      ? `${formData.archStyle.charAt(0).toUpperCase() + formData.archStyle.slice(1)}, open-plan living`
      : 'Modern, open-plan living';
    const parking = formData.carParking ? 'Garden + car parking' : 'Garden + compact frontage';
    return [beds, facing, style, parking];
  }, [formData]);

  return (
    <AG opacity={vis as any}>
      <Rect x={61} y={246} width={359} height={257} rx={22} fill={C.card} stroke={C.cardBorder} strokeWidth={1.2} />
      <SvgText x={84} y={278} fontSize={10} fontWeight="700" letterSpacing={1} fill={C.amber}>
        YOUR BRIEF
      </SvgText>
      {briefRows.map((label, i) => {
        const cy = 317 + 41 * i;
        return (
          <Fade key={label + i} clk={clk} a={0.05 + 0.28 * i} b={0.3 + 0.28 * i}>
            <Circle cx={92} cy={cy} r={8} stroke={C.amber} strokeWidth={1.3} fill="none" />
            <Path
              d={`M88.3 ${cy + 0.5} L91 ${cy + 3.2} L95.8 ${cy - 3}`}
              stroke={C.amber}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <SvgText x={113} y={cy + 5} fontSize={14.5} fill={C.ink}>
              {label}
            </SvgText>
            <Line x1={84} y1={cy + 14} x2={391} y2={cy + 14} stroke={C.grid} strokeWidth={1} />
          </Fade>
        );
      })}
      <SvgText x={84} y={473} fontSize={10} fill={C.mute}>
        Every detail shapes the design.
      </SvgText>
    </AG>
  );
}

/* ───────────────────────── scene 2 · the plot (1.5 – 3.2s) ───────────────────────── */

function PlotScene({ clk, formData }: { clk: Clock; formData?: any }) {
  const C = useTokens();
  const vis = useMemo(() => keys(clk, [1.4, 1.55, 3.0, 3.2], [0, 1, 1, 0]), [clk]);
  const L = 103, R = 377, T = 279, B = 486; // plot rectangle
  const edge = 3;

  const wLabel = formData?.plotWidth ? `${formData.plotWidth} ft` : '40 ft';
  const dLabel = formData?.plotDepth ? `${formData.plotDepth} ft` : '60 ft';
  const compassLetter = formData?.facing ? formData.facing.charAt(0).toUpperCase() : 'N';

  return (
    <AG opacity={vis as any}>
      <Rect x={47} y={219} width={386} height={330} rx={22} fill={C.card} stroke={C.cardBorder} strokeWidth={1.2} />

      {/* dimension lines */}
      <Fade clk={clk} a={1.6} b={1.9}>
        <Line x1={L} y1={259} x2={R} y2={259} stroke={C.dim} strokeWidth={1} />
        <Line x1={L} y1={254} x2={L} y2={264} stroke={C.dim} strokeWidth={1} />
        <Line x1={R} y1={254} x2={R} y2={264} stroke={C.dim} strokeWidth={1} />
        <SvgText x={240} y={250} fontSize={8} textAnchor="middle" fill={C.mute}>
          {wLabel}
        </SvgText>
        <Line x1={83} y1={T} x2={83} y2={B} stroke={C.dim} strokeWidth={1} />
        <Line x1={78} y1={T} x2={88} y2={T} stroke={C.dim} strokeWidth={1} />
        <Line x1={78} y1={B} x2={88} y2={B} stroke={C.dim} strokeWidth={1} />
        <SvgText x={63} y={380} fontSize={8} textAnchor="middle" fill={C.mute}>
          {dLabel}
        </SvgText>
      </Fade>

      {/* boundary draws clockwise: top → right → bottom → left */}
      <Draw clk={clk} t0={1.55} t1={1.95} x1={L} y1={T} x2={R} y2={T} color={C.amber} w={edge} cap="square" />
      <Draw clk={clk} t0={1.95} t1={2.32} x1={R} y1={T} x2={R} y2={B} color={C.amber} w={edge} cap="square" />
      <Draw clk={clk} t0={2.32} t1={2.69} x1={R} y1={B} x2={L} y2={B} color={C.amber} w={edge} cap="square" />
      <Draw clk={clk} t0={2.69} t1={3.06} x1={L} y1={B} x2={L} y2={T} color={C.amber} w={edge} cap="square" />

      {/* compass */}
      <Fade clk={clk} a={2.35} b={2.65}>
        <Circle cx={339} cy={317} r={16} fill={C.card} stroke={C.amberSoft} strokeWidth={1} />
        <Polygon points="339,306 344.5,325 339,321.5 333.5,325" fill={C.amber} />
        <SvgText x={339} y={298} fontSize={7} textAnchor="middle" fill={C.mute}>
          {compassLetter}
        </SvgText>
      </Fade>

      <Fade clk={clk} a={2.5} b={2.8}>
        <SvgText x={126} y={517} fontSize={7.5} letterSpacing={0.8} fill={C.amber}>
          PLOT BOUNDARY CONFIRMED
        </SvgText>
      </Fade>
    </AG>
  );
}

/* ───────────────────────── scene 3 · floor plan (3.2 – 8s) ───────────────────────── */

const X0 = 63, X1 = 417, Y0 = 239, Y1 = 521; // outer walls

const ROOMS: [string, number, number][] = [
  ['LIVING', 109, 300],
  ['BEDROOM 1', 260, 300],
  ['BATH', 354, 303],
  ['KITCHEN', 104, 419],
  ['DINING', 251, 492],
  ['BEDROOM 2', 361, 452],
];

function PlanScene({ clk, formData }: { clk: Clock; formData?: any }) {
  const C = useTokens();
  // card behind everything (stays until the 3D cube takes over)
  const cardO = useMemo(
    () => keys(clk, [3.0, 3.15, 9.1, 9.3, 9.7, 9.95], [0, 1, 1, 0.3, 0.15, 0]),
    [clk],
  );
  // plan fades out while the cube rises
  const planO = useMemo(
    () => keys(clk, [3.0, 3.1, 8.4, 8.9, 9.1, 9.3, 9.5, 9.7, 9.95], [0, 1, 1, 0.8, 0.45, 0.3, 0.17, 0.08, 0]),
    [clk],
  );
  const scanX = useMemo(() => lerp(seg(clk, 6.05, 8.0), 50, 373), [clk]);
  const scanO = useMemo(() => keys(clk, [6.05, 6.15, 7.9, 8.0], [0, 0.75, 0.75, 0]), [clk]);
  const w = 3.2;

  const dimText = formData?.plotWidth ? `${formData.plotWidth}'-0"` : '40\'-0"';

  return (
    <G>
      <AG opacity={cardO as any}>
        <Rect x={44} y={209} width={392} height={336} rx={20} fill={C.card} stroke={C.cardBorder} strokeWidth={1.2} />
      </AG>

      <AG opacity={planO as any}>
        {/* dimension line */}
        <Fade clk={clk} a={4.2} b={4.45}>
          <Line x1={X0} y1={222} x2={X1} y2={222} stroke={C.dim} strokeWidth={1} />
          <Line x1={X0} y1={217} x2={X0} y2={227} stroke={C.dim} strokeWidth={1} />
          <Line x1={X1} y1={217} x2={X1} y2={227} stroke={C.dim} strokeWidth={1} />
          <SvgText x={240} y={213} fontSize={7.5} textAnchor="middle" fill={C.mute}>
            {dimText}
          </SvgText>
        </Fade>

        {/* interior walls */}
        <Draw clk={clk} t0={4.55} t1={4.9} x1={204} y1={Y0} x2={204} y2={Y1} color={C.wall} w={w} cap="square" />
        <Draw clk={clk} t0={4.95} t1={5.2} x1={X0} y1={374} x2={204} y2={374} color={C.wall} w={w} cap="square" />
        <Draw clk={clk} t0={5.3} t1={5.55} x1={204} y1={417} x2={X1} y2={417} color={C.wall} w={w} cap="square" />
        <Draw clk={clk} t0={5.6} t1={6.15} x1={307} y1={Y0} x2={307} y2={Y1} color={C.wall} w={w} cap="square" />
        <Draw clk={clk} t0={6.3} t1={6.65} x1={204} y1={464} x2={X1} y2={464} color={C.wall} w={w} cap="square" />
        <Draw clk={clk} t0={6.5} t1={7.0} x1={127} y1={374} x2={127} y2={Y1} color={C.wall} w={w} cap="square" />

        {/* outer walls (amber): top → right → bottom → left (with entrance gap) */}
        <Draw clk={clk} t0={3.5} t1={4.8} x1={X0} y1={Y0} x2={X1} y2={Y0} color={C.amber} w={2.6} />
        <Draw clk={clk} t0={4.95} t1={5.6} x1={X1} y1={Y0} x2={X1} y2={Y1} color={C.amber} w={2.6} />
        <Draw clk={clk} t0={5.7} t1={6.5} x1={X1} y1={Y1} x2={X0} y2={Y1} color={C.amber} w={2.6} />
        <Draw clk={clk} t0={6.4} t1={7.5} x1={X0} y1={Y1} x2={X0} y2={305} color={C.amber} w={2.6} />

        {/* door swings */}
        <Fade clk={clk} a={6.1} b={6.6}>
          <Line x1={203} y1={373} x2={216} y2={361} stroke={C.amber} strokeWidth={1.8} strokeLinecap="round" />
          <Line x1={307} y1={416} x2={320} y2={404} stroke={C.amber} strokeWidth={1.8} strokeLinecap="round" />
          <Line x1={128} y1={463} x2={140} y2={450} stroke={C.amber} strokeWidth={1.8} strokeLinecap="round" />
        </Fade>

        {/* furniture */}
        <Fade clk={clk} a={6.2} b={6.9}>
          <Rect x={228} y={267} width={55} height={27} rx={3} fill="none" stroke={C.amber} strokeWidth={1.3} />
          <Line x1={236} y1={275} x2={275} y2={275} stroke={C.amber} strokeWidth={1.3} />
          <Rect x={76} y={397} width={42} height={24} rx={2} fill="none" stroke={C.amber} strokeWidth={1.3} />
          <Rect x={324} y={438} width={56} height={27} rx={3} fill="none" stroke={C.amber} strokeWidth={1.3} />
          <Line x1={332} y1={446} x2={372} y2={446} stroke={C.amber} strokeWidth={1.3} />
        </Fade>

        {/* room labels */}
        <Fade clk={clk} a={6.4} b={7.2}>
          {ROOMS.map(([name, x, y]) => (
            <SvgText key={name} x={x} y={y + 2.5} fontSize={7} letterSpacing={0.5} textAnchor="middle" fill={C.mute}>
              {name}
            </SvgText>
          ))}
        </Fade>

        {/* scan line sweeping left → right */}
        <AG opacity={scanO as any}>
          <ALine x1={scanX as any} y1={220} x2={scanX as any} y2={537} stroke={C.amberSoft} strokeWidth={1.6} />
        </AG>
      </AG>
    </G>
  );
}

/* ───────────────────────── scene 4 · the 3D cube (8 – 12s) ───────────────────────── */

const RISE = 126; // wall height in px
const Lb = [130.7, 457.3];
const Kb = [240, 402.7];
const Rb = [349.3, 457.3];
const Fb = [240, 513];
const up = (p: number[], d: number) => [p[0], p[1] - d];

const WIN_L = [[180, 355], [214, 371.7], [214, 407.3], [180, 390]];
const WIN_R = [[260, 354], [297.3, 336.7], [297.3, 372.7], [260, 390.7]];
const DOOR = [[226.7, 400.7], [246.7, 391.7], [246.7, 423.3], [226.7, 434]];
const roofLinesD = (dy: number) =>
  `M240 ${(298.3 + dy).toFixed(1)} L240 ${(351 + dy).toFixed(1)} ` +
  `M240 ${(330.7 + dy).toFixed(1)} L200 ${(310.7 + dy).toFixed(1)} ` +
  `M240 ${(330.7 + dy).toFixed(1)} L284 ${(310.7 + dy).toFixed(1)}`;

function CubeScene({ clk }: { clk: Clock }) {
  const C = useTokens();
  const m = useMemo(() => {
    // r: 0 → 1 as the roof rises (starts 8.3s, done 9.9s, ease-in-out)
    const r = seg(clk, 8.3, 9.9, Easing.inOut(Easing.quad));
    const rise = (a: string, b: string) => r.interpolate({ inputRange: [0, 1], outputRange: [a, b] });
    return {
      ground: seg(clk, 8.8, 9.5),
      slab: seg(clk, 8.0, 8.15),
      edgeIn: seg(clk, 8.0, 8.2),
      floorO: r.interpolate({ inputRange: [0.1, 0.5], outputRange: [0, 1], extrapolate: 'clamp' }),
      wallO: r.interpolate({ inputRange: [0.15, 0.6], outputRange: [0, 1], extrapolate: 'clamp' }),
      roof: rise(
        P([up(Kb, 0), up(Rb, 0), up(Fb, 0), up(Lb, 0)]),
        P([up(Kb, RISE), up(Rb, RISE), up(Fb, RISE), up(Lb, RISE)]),
      ),
      wallLeft: rise(P([up(Lb, 0), up(Fb, 0), Kb, Lb]), P([up(Lb, RISE), up(Fb, RISE), Kb, Lb])),
      wallRight: rise(P([up(Rb, 0), up(Fb, 0), Kb, Rb]), P([up(Rb, RISE), up(Fb, RISE), Kb, Rb])),
      edgeY: lerp(r, Lb[1], Lb[1] - RISE),
      winL: rise(P(shiftY(WIN_L, 65)), P(WIN_L)),
      winR: rise(P(shiftY(WIN_R, 65)), P(WIN_R)),
      door: rise(P(shiftY(DOOR, 14)), P(DOOR)),
      winO: seg(clk, 8.85, 9.0),
      doorO: seg(clk, 8.85, 9.05),
      lines: rise(roofLinesD(RISE), roofLinesD(0)),
      linesO: seg(clk, 9.2, 9.5),
    };
  }, [clk]);

  const visible = useMemo(() => keys(clk, [7.95, 8.0], [0, 1]), [clk]);
  const floorPts = P([Kb, Rb, Fb, Lb]);

  return (
    <AG opacity={visible as any}>
      {/* soft ground shadow */}
      <AG opacity={m.ground as any}>
        <Polygon points={P([[105, 457.3], [240, 392], [375, 457.3], [240, 522]])} fill={C.ground} />
      </AG>

      {/* floor + its back edges */}
      <AG opacity={m.floorO as any}>
        <Polygon points={floorPts} fill={C.floor} />
        <Line x1={Lb[0]} y1={Lb[1]} x2={Kb[0]} y2={Kb[1]} stroke={C.edge} strokeWidth={0.9} />
        <Line x1={Kb[0]} y1={Kb[1]} x2={Rb[0]} y2={Rb[1]} stroke={C.edge} strokeWidth={0.9} />
      </AG>

      {/* walls */}
      <AG opacity={m.wallO as any}>
        <APolygon points={m.wallLeft as any} fill={C.wallL} />
        <APolygon points={m.wallRight as any} fill={C.wallR} />
        <ALine x1={Lb[0]} y1={m.edgeY as any} x2={Lb[0]} y2={Lb[1]} stroke={C.edge} strokeWidth={1} />
        <ALine x1={Rb[0]} y1={m.edgeY as any} x2={Rb[0]} y2={Rb[1]} stroke={C.edge} strokeWidth={1} />
      </AG>

      {/* amber front edges of the floor */}
      <AG opacity={m.edgeIn as any}>
        <Path
          d={`M${Lb[0]} ${Lb[1]} L${Fb[0]} ${Fb[1]} L${Rb[0]} ${Rb[1]}`}
          stroke={C.amber}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
        />
      </AG>

      {/* roof slab — lifts from floor level up to wall height */}
      <AG opacity={m.slab as any}>
        <APolygon points={m.roof as any} fill={C.roof} stroke={C.edge} strokeWidth={1} strokeLinejoin="round" />
      </AG>

      {/* windows + door */}
      <AG opacity={m.winO as any}>
        <APolygon points={m.winL as any} fill={C.glass} stroke={C.edge} strokeWidth={0.8} />
        <APolygon points={m.winR as any} fill={C.glass} stroke={C.edge} strokeWidth={0.8} />
      </AG>
      <AG opacity={m.doorO as any}>
        <APolygon points={m.door as any} fill={C.door} stroke="#6B5A3A" strokeWidth={0.8} />
      </AG>

      {/* roof "Y" mark */}
      <AG opacity={m.linesO as any}>
        <APath d={m.lines as any} stroke={C.roofLines} strokeWidth={2.2} strokeLinecap="round" fill="none" />
      </AG>
    </AG>
  );
}

/* ───────────────────────── scene 5 · bottom cards (10 – 12s) ───────────────────────── */

function BottomCard({ clk }: { clk: Clock }) {
  const C = useTokens();
  const cardO = useMemo(() => seg(clk, 10.0, 10.25), [clk]);
  const workingO = useMemo(() => keys(clk, [10.0, 10.25, 11.3, 11.5], [0, 1, 1, 0]), [clk]);
  const readyO = useMemo(() => seg(clk, 11.3, 11.55), [clk]);
  const miniW = useMemo(() => lerp(seg(clk, 10.1, 11.4), 0, 353), [clk]);

  return (
    <G>
      <AG opacity={cardO as any}>
        <Rect x={42} y={564} width={396} height={125} rx={18} fill={C.card} stroke={C.cardBorder} strokeWidth={1.2} />
      </AG>

      {/* "putting the finishing touches on…" */}
      <AG opacity={workingO as any}>
        <SvgText x={64} y={594} fontSize={10.5} fontWeight="700" fill={C.ink}>
          Putting the finishing touches on
        </SvgText>
        <SvgText x={64} y={624} fontSize={14} fill={C.sub}>
          your home concept...
        </SvgText>
        <Rect x={64} y={650} width={353} height={6} rx={3} fill={C.track} />
        <ARect x={64} y={650} width={miniW as any} height={6} rx={3} fill={C.amber} />
      </AG>

      {/* "your home concept is ready" + button */}
      <AG opacity={readyO as any}>
        <Circle cx={77} cy={599} r={11} fill={C.green} />
        <Path
          d="M72 599.5 L75.8 603.3 L82.5 595.5"
          stroke="#fff"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <SvgText x={100} y={597} fontSize={10.5} fontWeight="700" fill={C.ink}>
          Your home concept is ready
        </SvgText>
        <SvgText x={100} y={612} fontSize={9} fill={C.sub}>
          A first look at what you can build.
        </SvgText>
        <Rect x={64} y={639} width={353} height={36} rx={9} fill={C.amber} />
        <SvgText x={240.5} y={661.5} fontSize={10} fontWeight="700" letterSpacing={1} textAnchor="middle" fill="#fff">
          VIEW HOUSE PLAN →
        </SvgText>
      </AG>
    </G>
  );
}

/* ───────────────────────── chrome: frame, header, footer ───────────────────────── */

function Chrome({ clk }: { clk: Clock }) {
  const C = useTokens();
  const fill = useMemo(() => lerp(seg(clk, 0, DURATION_S), 0, 416), [clk]);
  return (
    <G>
      <Rect x={15.5} y={17.5} width={449} height={813} rx={26} fill="none" stroke={C.frame} strokeWidth={1} />

      {/* brand */}
      <Path d="M40 40 L42 45 L47 47 L42 49 L40 54 L38 49 L33 47 L38 45 Z" fill={C.amber} />
      <SvgText x={55} y={52} fontSize={15} fontWeight="800" letterSpacing={0.5} fill={C.ink}>
        BOOLOK
      </SvgText>
      <SvgText x={55} y={65} fontSize={7.5} letterSpacing={0.5} fill={C.sub}>
        AI ARCHITECT
      </SvgText>

      {/* status pill */}
      <Rect x={364} y={39} width={80} height={22} rx={11} fill={C.card} stroke={C.cardBorder} strokeWidth={1} />
      <SvgText x={404} y={53} fontSize={8.5} letterSpacing={0.6} textAnchor="middle" fill={C.amber}>
        DESIGNING
      </SvgText>

      {/* progress */}
      <Rect x={31} y={745} width={416} height={6} rx={3} fill={C.track} />
      <ARect x={31} y={745} width={fill as any} height={6} rx={3} fill={C.amber} />
      <SvgText x={31} y={771} fontSize={7.5} letterSpacing={0.8} fill={C.mute}>
        DESIGNED AROUND YOU
      </SvgText>
      <PercentLabel clk={clk} />
      <SvgText x={31} y={803} fontSize={7.5} letterSpacing={0.8} fill={C.sub}>
        BOOLOK  ·  AI HOUSE PLAN
      </SvgText>
    </G>
  );
}

/* ───────────────────────── root component ───────────────────────── */

export interface HouseDesignLoaderProps {
  /** tapped on the "VIEW HOUSE PLAN →" button (only active once it appears) */
  onViewPlan?: () => void;
  /** fires when the 12s sequence finishes */
  onComplete?: () => void;
  /** real playback time in ms (default 12000 = same speed as the video) */
  durationMs?: number;
  style?: StyleProp<ViewStyle>;
  theme?: any;
  isDark?: boolean;
  formData?: any;
}

export default function HouseDesignLoader({
  onViewPlan,
  onComplete,
  durationMs = 12000,
  style,
  isDark: propIsDark,
  formData,
}: HouseDesignLoaderProps) {
  const themeContext = useTheme();
  const isDark = propIsDark !== undefined ? propIsDark : themeContext?.isDark ?? false;
  const C = isDark ? DARK_COLORS : LIGHT_COLORS;

  const { width: winW, height: winH } = useWindowDimensions();
  const isLaptop = winW >= 768;

  const clk = useRef(new Animated.Value(0)).current;
  const doneRef = useRef(onComplete);
  doneRef.current = onComplete;
  const [box, setBox] = useState({ w: 0, h: 0 });

  const handleFinish = () => {
    if (onViewPlan) {
      onViewPlan();
    } else if (onComplete) {
      onComplete();
    }
  };

  useEffect(() => {
    clk.setValue(0);
    const anim = Animated.timing(clk, {
      toValue: DURATION_S,
      duration: durationMs,
      easing: Easing.linear,
      useNativeDriver: false, // SVG props can't use the native driver
    });
    anim.start(({ finished }) => {
      if (finished) doneRef.current?.();
    });
    return () => anim.stop();
  }, [clk, durationMs]);

  const ready = useClockSelect(clk, (t) => t >= READY_AT);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((b) => (b.w === width && b.h === height ? b : { w: width, h: height }));
  };

  // Safe measurement taking window insets into account so it NEVER crops
  const containerW = box.w || winW;
  const containerH = box.h || winH;

  // For laptop: leave generous vertical margins (40px) so the 848px height NEVER touches screen bounds
  // For mobile: leave 16px vertical margins so nothing gets cut off by safe area/tabs
  const marginX = isLaptop ? 48 : 16;
  const marginY = isLaptop ? 48 : 24;

  const availW = Math.max(260, containerW - marginX);
  const availH = Math.max(340, containerH - marginY);

  const s = Math.min(availW / VB_W, availH / VB_H);
  const cw = VB_W * s;
  const ch = VB_H * s;
  const ox = (containerW - cw) / 2;
  const oy = (containerH - ch) / 2;

  // faint blueprint grid that fills the whole viewport
  const gridPath = useMemo(() => {
    if (!s || containerW <= 0 || containerH <= 0) return '';
    const step = 24 * s;
    let d = '';
    for (let x = (ox + 13.5 * s) % step; x < containerW; x += step) d += `M${x.toFixed(1)} 0V${containerH}`;
    for (let y = (oy + 13.5 * s) % step; y < containerH; y += step) d += `M0 ${y.toFixed(1)}H${containerW}`;
    return d;
  }, [s, ox, oy, containerW, containerH]);

  return (
    <ThemeTokensContext.Provider value={C}>
      <View style={[styles.root, { backgroundColor: C.outerBg }, style]} onLayout={onLayout}>
        {/* Full Viewport Blueprint Grid Pattern */}
        {containerW > 0 && containerH > 0 && (
          <Svg width={containerW} height={containerH} style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
            <Path d={gridPath} stroke={C.grid} strokeWidth={1} />
          </Svg>
        )}

        {/* Laptop Elevation Frame / Backdrop Card */}
        {isLaptop && s > 0 && (
          <View
            style={[
              styles.laptopFrame,
              {
                pointerEvents: 'none',
                left: ox,
                top: oy,
                width: cw,
                height: ch,
                borderRadius: 26 * s,
                backgroundColor: C.bg,
                borderColor: isDark ? 'rgba(218,165,32,0.25)' : 'rgba(218,165,32,0.3)',
                boxShadow: isDark
                  ? '0 25px 60px rgba(0,0,0,0.7), 0 0 35px rgba(245,158,11,0.08)'
                  : '0 20px 50px rgba(0,0,0,0.08), 0 0 30px rgba(207,130,18,0.06)',
              } as any,
            ]}
          />
        )}

        {/* Floating Top Right Skip Button */}
        <Pressable
          onPress={handleFinish}
          style={({ pressed }) => [
            styles.skipBtn,
            {
              backgroundColor: isDark ? 'rgba(17, 24, 39, 0.9)' : 'rgba(253, 253, 248, 0.9)',
              borderColor: C.cardBorder,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[styles.skipBtnText, { color: C.amber }]}>Skip</Text>
          <MaterialIcons name="fast-forward" size={14} color={C.amber} />
        </Pressable>

        {/* Animated SVG Scene */}
        {s > 0 && (
          <>
            <Svg
              width={cw}
              height={ch}
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              style={{ position: 'absolute', left: ox, top: oy, pointerEvents: 'none' }}
            >
              <Chrome clk={clk} />
              <StageTitle clk={clk} />
              <BriefScene clk={clk} formData={formData} />
              <PlotScene clk={clk} formData={formData} />
              <PlanScene clk={clk} formData={formData} />
              <CubeScene clk={clk} />
              <BottomCard clk={clk} />
            </Svg>

            {/* Clickable Overlay for "VIEW HOUSE PLAN →" */}
            {ready && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View house plan"
                onPress={handleFinish}
                style={({ pressed }) => ({
                  position: 'absolute',
                  left: ox + 64 * s,
                  top: oy + 639 * s,
                  width: 353 * s,
                  height: 36 * s,
                  borderRadius: 9 * s,
                  backgroundColor: pressed ? 'rgba(0,0,0,0.15)' : 'transparent',
                })}
              />
            )}
          </>
        )}
      </View>
    </ThemeTokensContext.Provider>
  );
}

// Export both names for compatibility
export { HouseDesignLoader };

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  laptopFrame: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  skipBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 24 : 14,
    right: 18,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  skipBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
