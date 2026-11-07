import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Platform, useWindowDimensions, Share, Alert, Modal, ActivityIndicator, Image,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../constants/theme';
import HousePlanLoadingAnimation from '../../components/HousePlanLoadingAnimation';
import { API_BASE_URL, resolveImageUrl } from '../../lib/api';
import * as SecureStore from 'expo-secure-store';

// ─── Data Contracts & Types ──────────────────────────────────────────────────
type PlotShape = 'rectangular' | 'square' | 'l-shaped' | 'irregular';
type FacingDir = 'north' | 'northeast' | 'east' | 'southeast' | 'south' | 'southwest' | 'west' | 'northwest';
type Stories = 1 | 2 | 3 | 4;
type DiningOpt = 'separate' | 'open' | 'in_kitchen' | 'none';
type BathPref = 'attached' | 'shared' | 'mix';
type KitchenType = 'closed' | 'open' | 'island' | 'semi-open';
type ParkingType = 'open' | 'covered' | 'garage' | 'stilt';
type StairLoc = 'center' | 'side' | 'entrance' | 'external';
type StairWidth = 'standard' | 'comfortable' | 'wide';
type StairShape = 'straight' | 'l-shaped' | 'u-shaped' | 'spiral';
type VastuStrict = 'strict' | 'balanced' | 'flexible';
type ArchStyle = 'traditional' | 'contemporary' | 'eco' | 'mediterranean' | 'minimalist';
type FinishQ = 'economy' | 'standard' | 'premium' | 'luxury';
type WinPref = 'large' | 'moderate' | 'small';
type SiteSlope = 'flat' | 'toward_road' | 'away_road' | 'side';
type ExistFeat = 'borewell' | 'septic_tank' | 'trees' | 'old_structure' | 'water_tank' | 'electric_pole' | 'drainage';

interface FormData {
  // 01 Plot & Dimensioning
  plotWidth: number;
  plotDepth: number;
  plotUnit: 'feet' | 'meters';
  plotShape: PlotShape;
  plotShapeDesc: string;
  facing: FacingDir;
  roadAccess: string[];
  roadWidth: number;
  // 02 Occupancy & Demographics
  adults: number;
  children: number;
  elders: number;
  pets: boolean;
  domesticHelp: boolean;
  servantQuarter: boolean;
  guestFreq: 'rarely' | 'occasionally' | 'frequently';
  cars: number;
  bikes: number;
  // 03 Spatial Program & Verticality
  stories: Stories;
  bedrooms: number;
  mbAttachedBath: boolean;
  mbWardrobe: boolean;
  mbStudy: boolean;
  mbBalcony: boolean;
  bathPref: BathPref;
  livingRoom: boolean;
  dining: DiningOpt;
  poojaRoom: boolean;
  study: boolean;
  storeRoom: boolean;
  balconies: number;
  terraceAccess: boolean;
  // 04 Culinary & Food Service
  kitchenType: KitchenType;
  kitchenFeatures: string[];
  diningCapacity: '4' | '6' | '8' | '10+';
  // 05 Vehicular Logistics
  carParking: boolean;
  parkingType: ParkingType;
  // 06 Vertical Circulation
  stairLoc: StairLoc;
  stairWidth: StairWidth;
  stairShape: StairShape;
  // 07 Vastu Mandala Alignment
  vastuEnabled: boolean;
  vastuStrictness: VastuStrict;
  vastuReqs: string[];
  // 08 Envelope & Typology
  archStyle: ArchStyle;
  finish: FinishQ;
  windowPref: WinPref;
  futureExpansion: boolean;
  // 09 Constraints & Topography
  existingFeatures: { feature: ExistFeat; location: string }[];
  neighborSides: string[];
  siteSlope: SiteSlope;
  // 10 Specifications & Remarks
  specialNotes: string;
  avoidNotes: string;
}

const DEFAULTS: FormData = {
  plotWidth: 30, plotDepth: 40, plotUnit: 'feet', plotShape: 'rectangular',
  plotShapeDesc: '', facing: 'north', roadAccess: ['front'], roadWidth: 20,
  adults: 2, children: 0, elders: 0, pets: false, domesticHelp: false,
  servantQuarter: false, guestFreq: 'rarely', cars: 1, bikes: 1,
  stories: 1, bedrooms: 2, mbAttachedBath: true, mbWardrobe: false,
  mbStudy: false, mbBalcony: false, bathPref: 'attached', livingRoom: true,
  dining: 'separate', poojaRoom: false, study: false, storeRoom: true,
  balconies: 1, terraceAccess: false,
  kitchenType: 'closed', kitchenFeatures: [], diningCapacity: '6',
  carParking: true, parkingType: 'covered',
  stairLoc: 'side', stairWidth: 'comfortable', stairShape: 'straight',
  vastuEnabled: false, vastuStrictness: 'balanced', vastuReqs: [],
  archStyle: 'contemporary', finish: 'standard', windowPref: 'large', futureExpansion: false,
  existingFeatures: [], neighborSides: [], siteSlope: 'flat',
  specialNotes: '', avoidNotes: '',
};

// ─── Professional Architectural UI Primitives (Mobile Ergonomic) ───────────────

function Toggle({ value, onToggle, label, sub, theme }: any) {
  return (
    <Pressable
      onPress={() => onToggle(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={styles.toggleRow}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[styles.toggleLabel, { color: theme.onSurface }]}>{label}</Text>
        {sub && <Text style={[styles.toggleSub, { color: theme.onSurfaceVariant }]}>{sub}</Text>}
      </View>
      <View
        style={[
          styles.switchTrack,
          {
            backgroundColor: value ? '#DAA520' : theme.outlineVariant,
            borderColor: value ? '#B8860B' : theme.outlineVariant,
          },
        ]}
      >
        <View
          style={[
            styles.switchThumb,
            {
              transform: [{ translateX: value ? 18 : 2 }],
              backgroundColor: '#FFFFFF',
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

function Stepper({ value, onChange, min = 0, max = 99, label, sub, theme, unit }: any) {
  return (
    <View style={styles.stepperRow}>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={[styles.stepperLabel, { color: theme.onSurface }]}>{label}</Text>
        {sub && <Text style={[styles.stepperSub, { color: theme.onSurfaceVariant }]}>{sub}</Text>}
      </View>
      <View style={[styles.stepperControls, { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.outlineVariant }]}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          style={({ pressed }) => [
            styles.stepBtn,
            { opacity: value <= min ? 0.25 : pressed ? 0.6 : 1 },
          ]}
        >
          <MaterialIcons name="remove" size={18} color={theme.onSurface} />
        </Pressable>
        <View style={styles.stepDisplay}>
          <Text style={[styles.stepValue, { color: theme.onSurface }]}>{value}</Text>
          {unit && <Text style={[styles.stepUnit, { color: theme.onSurfaceVariant }]}>{unit}</Text>}
        </View>
        <Pressable
          onPress={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          style={({ pressed }) => [
            styles.stepBtn,
            { opacity: value >= max ? 0.25 : pressed ? 0.6 : 1 },
          ]}
        >
          <MaterialIcons name="add" size={18} color={theme.onSurface} />
        </Pressable>
      </View>
    </View>
  );
}

function SegCtrl({ value, onChange, options, theme }: any) {
  return (
    <View style={[styles.segCtrl, { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.outlineVariant }]}>
      {options.map((opt: any) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              styles.segBtn,
              active && { backgroundColor: theme.surfaceContainer, borderColor: 'rgba(218,165,32,0.4)', borderWidth: 1 },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.segText,
                {
                  color: active ? theme.primary : theme.onSurfaceVariant,
                  fontWeight: active ? '700' : '500',
                },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function RadioCard({ value, current, onPress, label, iconName, sub, theme }: any) {
  const active = value === current;
  return (
    <Pressable
      onPress={() => onPress(value)}
      style={({ pressed }) => [
        styles.radioCard,
        {
          borderColor: active ? theme.primary : theme.outlineVariant,
          backgroundColor: active ? 'rgba(218,165,32,0.08)' : theme.surfaceContainerLowest,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {iconName && (
        <View style={[styles.radioIconBox, { backgroundColor: active ? 'rgba(218,165,32,0.16)' : theme.surfaceContainer }]}>
          <MaterialCommunityIcons name={iconName} size={18} color={active ? theme.primary : theme.onSurfaceVariant} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardLabel, { color: active ? theme.primary : theme.onSurface }]}>{label}</Text>
        {sub && <Text style={[styles.cardSub, { color: theme.onSurfaceVariant }]}>{sub}</Text>}
      </View>
      <View
        style={[
          styles.radioIndicator,
          {
            borderColor: active ? theme.primary : theme.outlineVariant,
          },
        ]}
      >
        {active && <View style={[styles.radioIndicatorDot, { backgroundColor: theme.primary }]} />}
      </View>
    </Pressable>
  );
}

function ChipCard({ value, active, onToggle, label, iconName, theme, subtitle, fullWidth }: any) {
  return (
    <Pressable
      onPress={() => onToggle(value)}
      style={({ pressed }) => [
        styles.chipCard,
        fullWidth && { width: '100%' },
        {
          borderColor: active ? theme.primary : theme.outlineVariant,
          backgroundColor: active ? 'rgba(218,165,32,0.08)' : theme.surfaceContainerLowest,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {iconName && (
        <MaterialCommunityIcons
          name={iconName}
          size={18}
          color={active ? theme.primary : theme.onSurfaceVariant}
          style={{ marginRight: 6 }}
        />
      )}
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={2}
          style={[
            styles.chipLabel,
            { color: active ? theme.primary : theme.onSurface, fontWeight: active ? '700' : '500' },
          ]}
        >
          {label}
        </Text>
        {subtitle && (
          <Text numberOfLines={1} style={[styles.chipSub, { color: theme.onSurfaceVariant }]}>
            {subtitle}
          </Text>
        )}
      </View>
      <View
        style={[
          styles.chipCheckbox,
          {
            borderColor: active ? theme.primary : theme.outlineVariant,
            backgroundColor: active ? theme.primary : 'transparent',
          },
        ]}
      >
        {active && <MaterialIcons name="check" size={12} color="#0A0F23" />}
      </View>
    </Pressable>
  );
}

function SectionHead({ phase, stepNum, title, sub, iconName, theme }: any) {
  return (
    <View style={styles.sectionHeaderWrap}>
      <View style={styles.sectionMetaRow}>
        <View style={styles.phasePill}>
          <Text style={[styles.phaseText, { color: theme.primary }]}>SECTION {String(stepNum).padStart(2, '0')}</Text>
        </View>
        <Text style={[styles.phaseCode, { color: theme.onSurfaceVariant }]}>{phase.toUpperCase()}</Text>
      </View>
      <View style={styles.sectionTitleRow}>
        <View style={[styles.sectionIconRing, { borderColor: 'rgba(218,165,32,0.3)', backgroundColor: 'rgba(218,165,32,0.08)' }]}>
          <MaterialCommunityIcons name={iconName} size={18} color={theme.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>{title}</Text>
          {sub && <Text style={[styles.sectionSub, { color: theme.onSurfaceVariant }]}>{sub}</Text>}
        </View>
      </View>
    </View>
  );
}

function Notice({ type = 'info', msg, theme }: any) {
  const isWarn = type === 'warning';
  const isErr = type === 'error';
  const color = isErr ? '#EF4444' : isWarn ? '#F59E0B' : theme.primary;
  const icon = isErr ? 'alert-circle-outline' : isWarn ? 'alert-outline' : 'information-outline';

  return (
    <View style={[styles.noticeContainer, { borderColor: color + '40', backgroundColor: color + '10' }]}>
      <MaterialCommunityIcons name={icon as any} size={16} color={color} style={{ marginTop: 2 }} />
      <Text style={[styles.noticeText, { color }]}>{msg}</Text>
    </View>
  );
}

function FieldLabel({ children, help, theme }: any) {
  return (
    <View style={{ marginBottom: 6, marginTop: 4 }}>
      <Text style={[styles.fieldLabel, { color: theme.onSurface }]}>{children}</Text>
      {help && <Text style={[styles.fieldHelp, { color: theme.onSurfaceVariant }]}>{help}</Text>}
    </View>
  );
}

function HairlineDivider({ theme }: any) {
  return <View style={[styles.hairline, { backgroundColor: theme.outlineVariant }]} />;
}


// ─── Default Architectural Prompts for 2D, 3D, and Both ────────────────────────
export const DEFAULT_PROMPT_2D = `# 2D ARCHITECTURAL FLOOR PLAN GENERATION SYSTEM
Generate a professional 2D architectural CAD floor plan drawing. Pure top-down orthographic plan view.
Strictly 2D blueprint drafting standards: clean high-contrast dark architectural linework on pure white background, clear room labels with dimensions, door swing arcs, window openings, staircase details with direction arrows, bathroom fixtures, kitchen counters, North arrow, and area dimension schedule.
DO NOT render building exterior facade, roof, or outdoor landscaping. Strictly interior 2D floor plan only.`;

export const DEFAULT_PROMPT_3D = `# 3D ARCHITECTURAL CUTAWAY VISUALIZATION SYSTEM
Generate a high-end 3D architectural cutaway floor plan visualization. Top-down isometric cutaway view revealing full interior layout.
Interior and exterior partition walls cut at door-frame height with roof removed to clearly reveal room arrangements. Photorealistic materials: hardwood and porcelain tile flooring, contemporary furniture, living area sofa setup, dining table, kitchen cabinetry with marble counters, beds with textiles, bathroom fixtures, ambient natural daylighting, soft architectural shadows.
The 3D model must match the exact same room positions as the 2D floor plan. DO NOT render building exterior facade, exterior walls, or outdoor landscaping. Strictly interior 3D cutaway floor plan visualization only.`;

// ─── Universal Architectural System Prompt ─────────────────────────────────────
export const DEFAULT_UNIVERSAL_PROMPT = `# UNIVERSAL ARCHITECTURAL 2D AND 3D FLOOR PLAN GENERATION SYSTEM

## ROLE

You are an expert architectural design and visualization AI specializing in residential building planning, architectural geometry, floor-plan generation, and 3D architectural visualization.

Your task is to accept a user-provided JSON input containing residential building requirements and automatically generate:

1. Professional 2D architectural floor plans.
2. Corresponding 3D architectural visualizations.

The system must work with different JSON inputs, plot dimensions, building configurations, floor counts, room requirements, architectural styles, and design preferences.

The supplied JSON is the primary source of truth for the project requirements.

---

## PHASE 1: UNDERSTAND AND PROCESS USER INPUT

Accept the user's JSON input in the specified format.

Dynamically identify and extract:

- Project information.
- Plot dimensions and shape.
- Plot orientation and road-facing direction.
- Road width and access points.
- Setback requirements.
- Number of floors.
- Room names and quantities.
- Room dimensions, if provided.
- Attached bathrooms and wardrobes.
- Staircases and floor connections.
- Balconies, terraces and open spaces.
- Doors and windows.
- Parking requirements.
- Circulation requirements.
- Architectural style.
- Lighting and ventilation preferences.
- Other user-defined requirements.

Do not assume that every JSON input contains the same rooms or number of floors.

Adapt the design process to the actual input.

### Input interpretation rules

1. Support any reasonable residential building configuration.
2. Do not assume a fixed number of floors.
3. Do not assume a fixed number of bedrooms.
4. Do not assume fixed room dimensions.
5. Respect explicitly supplied coordinates and dimensions.
6. If room dimensions are not supplied, determine suitable dimensions based on the available plot area and user requirements.
7. If coordinates are not supplied, calculate room positions and create a consistent architectural layout.
8. Respect the user's architectural style and design preferences.
9. Identify missing or contradictory requirements.
10. Never silently modify explicitly specified dimensions or requirements.

If essential information is missing and cannot reasonably be determined, request clarification before proceeding.

---

## PHASE 2: ARCHITECTURAL GEOMETRY GENERATION

Before generating images, create an internal structured architectural representation.

Calculate:

- Plot boundary.
- Buildable envelope.
- Setback areas.
- Room coordinates.
- Room dimensions.
- Room areas.
- Wall thicknesses.
- Door positions.
- Door opening directions.
- Window positions.
- Staircase geometry.
- Floor-to-floor connections.
- Balcony and terrace geometry.
- Open-to-sky areas.
- Room adjacencies.
- Circulation paths.

Ensure that the geometry is consistent across all floors.

### Geometry validation

Validate:

1. Every room is inside the permitted building envelope unless explicitly designated otherwise.
2. Rooms do not unintentionally overlap.
3. Room dimensions match their specified dimensions.
4. Doors connect the intended spaces.
5. Attached bathrooms have actual connecting doors.
6. Walk-in wardrobes have actual connecting doors.
7. Staircases connect the appropriate floors.
8. Balconies connect to their corresponding rooms.
9. Courtyard voids align between floors.
10. Setbacks remain unobstructed.
11. All circulation spaces are accessible.
12. No unexplained empty spaces exist inside the building footprint.

If a conflict exists, resolve it only when the solution does not violate explicit user requirements. Otherwise, ask for clarification.

---

## PHASE 3: GENERATE 2D ARCHITECTURAL FLOOR PLANS

Automatically generate a separate professional 2D floor-plan image for every floor specified in the JSON.

For example:

- Ground floor.
- First floor.
- Second floor.
- Additional floors, if specified.

Do not assume that only two floors are required.

### 2D drawing requirements

Use professional architectural drafting standards.

**View:**

- True top-down orthographic view.
- Accurate proportions.
- Consistent scale.
- Clear architectural linework.

**Include:**

- Plot boundary.
- Road and road-facing direction.
- Main gate.
- Pedestrian entrance.
- Vehicle entrance.
- Setbacks.
- Exterior and interior walls.
- All specified rooms.
- Room names.
- Room dimensions.
- Door positions.
- Door opening arcs.
- Window positions.
- Staircase details.
- Furniture where useful.
- Bathroom fixtures.
- Kitchen fixtures.
- Balconies.
- Terraces.
- Courtyards and voids.
- Parking.
- Circulation areas.
- North arrow.
- Dimension annotations.
- Floor designation.
- Area statement.

Every room must be labelled clearly.

Every dimension must be accurate.

Do not allow furniture to obscure architectural elements.

Do not use decorative landscaping to conceal geometric mistakes or unexplained spaces.

### 2D output

Generate individual images for every floor.

Maintain the same orientation and coordinate reference across all floor plans.

---

## PHASE 4: GENERATE 3D ARCHITECTURAL VISUALIZATIONS

After generating the 2D plans, automatically generate corresponding 3D visualizations.

The 3D visualizations MUST be derived from the architectural geometry used to generate the 2D plans.

Do not independently redesign the building during 3D generation.

### 3D generation requirements

Generate a separate 3D cutaway architectural visualization for every floor.

Show:

- Exterior and interior walls.
- Individual rooms.
- Doors and windows.
- Furniture.
- Beds and wardrobes.
- Bathroom fixtures.
- Kitchen cabinets and counters.
- Dining furniture.
- Living room furniture.
- Staircases.
- Balconies.
- Terraces.
- Courtyards.
- Parking areas.
- Circulation spaces.

### 3D visualization style

Use:

- Realistic architectural visualization.
- Accurate room proportions.
- Professional materials and textures.
- Natural lighting.
- Realistic shadows.
- Clear room separation.
- Appropriate furniture placement.
- A consistent architectural style across floors.

Use a top-down isometric or elevated cutaway perspective that allows the viewer to understand the complete floor layout.

Do not allow walls, roofs, furniture or camera angles to hide important rooms.

### 3D geometry preservation

The 3D model must preserve:

1. Room positions from the 2D plan.
2. Room dimensions.
3. Wall locations.
4. Door locations.
5. Window locations.
6. Staircase positions.
7. Balcony positions.
8. Courtyard and void locations.
9. Floor connections.
10. Building orientation.

The 3D model must represent the same building shown in the 2D floor plans.

---

## PHASE 5: FINAL VALIDATION

Before presenting the results, compare the generated 2D plans and 3D visualizations.

Check:

- Every specified room is represented.
- No unauthorized rooms have been added.
- No specified rooms have been omitted.
- Dimensions are consistent.
- Room positions are consistent.
- Doors and windows are consistent.
- Staircases align across floors.
- Courtyards and open-to-below spaces are correctly represented.
- Balconies and terraces are correctly positioned.
- The architectural layout is consistent across all outputs.

If a discrepancy is detected, correct the output before presenting it.

---

## PHASE 6: FINAL OUTPUT

Automatically provide the following outputs:

### A. 2D Architectural Floor Plans

- One separate image for each floor.
- Complete architectural annotations.
- Room names and dimensions.
- Doors, windows and staircase details.

### B. 3D Architectural Visualizations

- One separate 3D image for each floor.
- Realistic furniture and materials.
- Accurate representation of the corresponding 2D plan.

### C. Final Design Summary

Provide:

- Plot dimensions.
- Number of floors.
- Total number of rooms.
- Floor-wise room list.
- Floor-wise area calculations, where available.
- Setback information.
- Important design features.
- Validation results.

---

## CRITICAL RULES

1. The system must work with any valid JSON input following the supplied architectural input structure.
2. Never hardcode a particular house layout.
3. Never assume fixed plot dimensions.
4. Never assume fixed room counts.
5. Never assume a fixed number of floors.
6. Never invent user requirements.
7. Never alter explicitly provided room coordinates or dimensions.
8. When dimensions are not provided, calculate them based on the available constraints.
9. Generate all 2D floor plans before generating their corresponding 3D visualizations.
10. Use the same architectural geometry for both 2D and 3D.
11. Do not require separate user instructions to initiate 3D generation.
12. Do not stop after generating the 2D images.
13. Generate all requested floors.
14. Prioritize architectural accuracy over visual decoration.

**FINAL OBJECTIVE:**

For every valid residential architectural JSON input, automatically interpret the requirements, calculate and validate the architectural geometry, generate professional 2D floor plans for all floors, and then generate matching realistic 3D architectural visualizations for all floors. do not give the exterior, i want only the floor plan, and 2d image should be separate and 3d image should be separate`;


// ─── Main Architectural Studio Component ──────────────────────────────────────
export default function BlueprintScreen() {
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const isSmallMobile = width < 380;

  const [form, setForm] = useState<FormData>(DEFAULTS);
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // OpenAI & Architectural AI State
  const [outputMode, setOutputMode] = useState<'both' | '2d' | '3d'>('both');
  const [openAiKey, setOpenAiKey] = useState<string>('');
  const [plan2dUrl, setPlan2dUrl] = useState<string | null>(null);
  const [plan3dUrl, setPlan3dUrl] = useState<string | null>(null);
  const [designSummary, setDesignSummary] = useState<string | null>(null);
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [lastGeneratedMode, setLastGeneratedMode] = useState<'both' | '2d' | '3d'>('both');
  const [aiGenError, setAiGenError] = useState<string | null>(null);
  const [activePlanTab, setActivePlanTab] = useState<'both' | '2d' | '3d'>('both');
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // Load saved OpenAI Key if available
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'web') {
          const savedKey = localStorage.getItem('user_openai_api_key');
          if (savedKey) { setOpenAiKey(savedKey); }
        } else {
          const savedKey = await SecureStore.getItemAsync('user_openai_api_key');
          if (savedKey) { setOpenAiKey(savedKey); }
        }
      } catch (e) {
        console.warn('Error reading saved blueprint key:', e);
      }
    })();
  }, []);

  const downloadPlanImage = useCallback((url: string | null, filename: string) => {
    if (!url) return;
    const fullUrl = resolveImageUrl(url) || url;
    if (Platform.OS === 'web') {
      try {
        const a = document.createElement('a');
        a.href = fullUrl;
        a.download = filename;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (err: any) {
        console.error('Error downloading image:', err);
      }
    } else {
      Share.share({
        url: fullUrl,
        message: `Architectural Plan: ${fullUrl}`,
        title: filename,
      });
    }
  }, []);

  const executeGeneration = useCallback(async (modeToGenerate?: '2d' | '3d' | 'both') => {
    const targetMode = modeToGenerate || outputMode;
    const keyToUse = openAiKey.trim();

    setLastGeneratedMode(targetMode);
    setActivePlanTab(targetMode);
    setIsAiGenerating(true);
    setIsGenerating(true);
    setAiGenError(null);

    try {
      const json = buildJson();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (keyToUse) {
        headers['x-openai-key'] = keyToUse;
      }
      const res = await fetch(`${API_BASE_URL}/api/blueprint/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonData: json,
          mode: targetMode,
          apiKey: keyToUse || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to generate architectural plan with OpenAI.');
      }

      if (data.plan2dUrl) setPlan2dUrl(data.plan2dUrl);
      if (data.plan3dUrl) setPlan3dUrl(data.plan3dUrl);
      if (data.summary) {
        setDesignSummary(data.summary);
      }
      setIsAiGenerating(false);
      setIsGenerating(false);
      setSubmitted(true);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (err: any) {
      console.error('Generation error:', err);
      setIsAiGenerating(false);
      setIsGenerating(false);
      setAiGenError(err.message || 'Generation failed.');
      setSubmitted(false);
      if (Platform.OS === 'web') {
        window.alert(`Generation Failed\n\n${err.message || 'Could not complete floor plan generation with OpenAI.'}`);
      } else {
        Alert.alert('Generation Failed', err.message || 'Could not complete floor plan generation with OpenAI.', [{ text: 'OK' }]);
      }
    }
  }, [openAiKey, outputMode, form]);

  const upd = useCallback((key: keyof FormData, val: any) => {
    setForm(prev => ({ ...prev, [key]: val }));
  }, []);

  const allSteps = [
    { id: 0, phase: 'Site Analysis', label: 'Plot Geometry', iconName: 'ruler-square', badge: 'Required' },
    { id: 1, phase: 'Demographics', label: 'Occupancy', iconName: 'account-group-outline', badge: 'Required' },
    { id: 2, phase: 'Program', label: 'Spatial Schedule', iconName: 'floor-plan', badge: 'Required' },
    { id: 3, phase: 'Services', label: 'Kitchen & Dining', iconName: 'countertop-outline', badge: 'Program' },
    { id: 4, phase: 'Circulation', label: 'Vehicular Access', iconName: 'garage-variant', badge: 'Site' },
    { id: 5, phase: 'Orientation', label: 'Vastu Alignment', iconName: 'compass-rose', badge: 'Climatic' },
    { id: 6, phase: 'Typology', label: 'Envelope & Style', iconName: 'home-modern', badge: 'Aesthetic' },
    { id: 7, phase: 'Context', label: 'Site Constraints', iconName: 'map-marker-radius-outline', badge: 'Zoning' },
    { id: 8, phase: 'Summary', label: 'Specifications', iconName: 'clipboard-text-outline', badge: 'Review' },
  ];

  const totalSteps = allSteps.length;
  const progressPct = Math.round(((step + 1) / totalSteps) * 100);

  const goNext = () => {
    if (step < totalSteps - 1) {
      setStep(s => s + 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      executeGeneration(outputMode);
    }
  };

  const goPrev = () => {
    if (step > 0) {
      setStep(s => s - 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  // ─── JSON Export Specification ──
  const buildJson = () => {
    const rooms: any[] = [];
    if (form.livingRoom) rooms.push({ type: 'living_room', quantity: 1 });
    rooms.push({
      type: 'bedroom',
      quantity: form.bedrooms,
      master_features: {
        attached_bathroom: form.mbAttachedBath,
        walk_in_wardrobe: form.mbWardrobe,
        study_corner: form.mbStudy,
        balcony_access: form.mbBalcony,
      },
    });
    rooms.push({
      type: 'bathroom',
      preference: form.bathPref,
      quantity: form.bathPref === 'attached' ? form.bedrooms : Math.max(2, Math.ceil(form.bedrooms / 2)),
    });
    if (form.dining !== 'none') rooms.push({ type: 'dining', style: form.dining, capacity: form.diningCapacity });
    rooms.push({ type: 'kitchen', kitchen_type: form.kitchenType, features: form.kitchenFeatures });
    if (form.poojaRoom) rooms.push({ type: 'pooja_room' });
    if (form.study) rooms.push({ type: 'study' });
    if (form.storeRoom) rooms.push({ type: 'store_room' });
    if (form.balconies > 0) rooms.push({ type: 'balcony', quantity: form.balconies });
    if (form.carParking) rooms.push({ type: 'parking', parking_type: form.parkingType, cars: form.cars });
    if (form.domesticHelp && form.servantQuarter) rooms.push({ type: 'servant_quarter' });

    return {
      metadata: {
        engine: 'Boolok BIM Specification Core',
        version: '2026.4',
        standard: 'National Building Code / CMDA Development Regulations',
      },
      plot: {
        width: form.plotWidth,
        depth: form.plotDepth,
        unit: form.plotUnit,
        shape: form.plotShape,
        ...(form.plotShape === 'irregular' && { shape_description: form.plotShapeDesc }),
        facing: form.facing,
        road_access: form.roadAccess,
        road_width_front: form.roadWidth,
        calculated_area_sqft: form.plotUnit === 'feet' ? form.plotWidth * form.plotDepth : Math.round(form.plotWidth * form.plotDepth * 10.7639),
      },
      family: {
        adults: form.adults,
        children: form.children,
        elders: form.elders,
        pets: form.pets,
        domestic_help: form.domesticHelp,
        frequent_guests: form.guestFreq,
        vehicles: { cars: form.cars, bikes: form.bikes },
      },
      requirements: {
        stories: form.stories,
        rooms,
        terrace_access: form.terraceAccess,
        ...(form.stories >= 2 && {
          staircase: {
            staircase_type: form.stairLoc,
            width: form.stairWidth,
            shape: form.stairShape,
          },
        }),
      },
      vastu: form.vastuEnabled
        ? { enabled: true, strictness: form.vastuStrictness, specific_requirements: form.vastuReqs }
        : { enabled: false },
      style: {
        type: form.archStyle,
        finish: form.finish,
        window_preference: form.windowPref,
        future_expansion: form.futureExpansion,
      },
      site_context: {
        slope: form.siteSlope,
        existing_features: form.existingFeatures,
        neighboring_walls: form.neighborSides,
      },
      additional_notes: {
        special_requirements: form.specialNotes,
        things_to_avoid: form.avoidNotes,
      },
    };
  };

  const [copied, setCopied] = useState(false);



  const copyJsonToClipboard = useCallback(() => {
    const json = buildJson();
    const jsonStr = JSON.stringify(json, null, 2);
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(jsonStr);
    } else {
      Share.share({ message: jsonStr, title: 'house_plan.json' });
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [form]);

  // ─── Step Content Renderer ──
  const renderStep = () => {
    const curId = allSteps[step]?.id;

    // STEP 00: Plot & Dimensioning
    if (curId === 0) {
      const areaVal = form.plotWidth * form.plotDepth;
      const metricEquivalent = form.plotUnit === 'feet'
        ? (areaVal * 0.092903).toFixed(1) + ' sq.m'
        : (areaVal * 10.7639).toFixed(0) + ' sq.ft';

      return (
        <View>
          <SectionHead
            phase="Phase 01"
            stepNum={1}
            title="Site & Plot Geometry"
            sub="Set boundary dimensions, orientation bearing, and road frontage parameters."
            iconName="ruler-square"
            theme={theme}
          />

          <FieldLabel theme={theme}>
            Site Dimensions <Text style={{ color: theme.primary }}>*</Text>
          </FieldLabel>
          <View style={styles.dimRow}>
            <View style={styles.dimInputBox}>
              <Text style={[styles.dimLabel, { color: theme.onSurfaceVariant }]}>WIDTH [B]</Text>
              <TextInput
                value={form.plotWidth ? String(form.plotWidth) : ''}
                onChangeText={v => upd('plotWidth', Number(v) || 0)}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.outline}
                style={[styles.dimInput, { color: theme.onSurface, backgroundColor: theme.surfaceContainerLowest, borderColor: theme.outlineVariant }]}
              />
            </View>
            <View style={styles.dimSeparator}>
              <Text style={[styles.dimSeparatorText, { color: theme.onSurfaceVariant }]}>×</Text>
            </View>
            <View style={styles.dimInputBox}>
              <Text style={[styles.dimLabel, { color: theme.onSurfaceVariant }]}>DEPTH [L]</Text>
              <TextInput
                value={form.plotDepth ? String(form.plotDepth) : ''}
                onChangeText={v => upd('plotDepth', Number(v) || 0)}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.outline}
                style={[styles.dimInput, { color: theme.onSurface, backgroundColor: theme.surfaceContainerLowest, borderColor: theme.outlineVariant }]}
              />
            </View>
          </View>

          {/* Unit selector placed on clean row underneath for superior mobile ergonomics */}
          <View style={{ marginTop: 8, marginBottom: 4 }}>
            <SegCtrl
              value={form.plotUnit}
              onChange={(v: any) => upd('plotUnit', v)}
              options={[{ value: 'feet', label: 'Imperial (Feet / sq.ft)' }, { value: 'meters', label: 'Metric (Meters / sq.m)' }]}
              theme={theme}
            />
          </View>

          {areaVal > 0 && (
            <View style={[styles.metricStrip, { backgroundColor: isDark ? 'rgba(218,165,32,0.06)' : 'rgba(218,165,32,0.08)', borderColor: 'rgba(218,165,32,0.3)' }]}>
              <MaterialCommunityIcons name="calculator-variant-outline" size={16} color={theme.primary} />
              <Text style={[styles.metricStripText, { color: theme.onSurface, flex: 1 }]}>
                Gross Site Area: <Text style={{ fontWeight: '800', color: theme.primary }}>{areaVal.toLocaleString()} {form.plotUnit === 'feet' ? 'sq.ft' : 'sq.m'}</Text>
                {' '}<Text style={{ color: theme.onSurfaceVariant, fontSize: 11 }}>({metricEquivalent})</Text>
              </Text>
            </View>
          )}

          <HairlineDivider theme={theme} />

          <FieldLabel theme={theme}>
            Plot Boundary Morphology <Text style={{ color: theme.primary }}>*</Text>
          </FieldLabel>
          <View style={styles.grid2}>
            {[
              { s: 'rectangular' as PlotShape, label: 'Regular Rectangular', icon: 'vector-rectangle' },
              { s: 'square' as PlotShape, label: 'Equilateral Square', icon: 'vector-square' },
              { s: 'l-shaped' as PlotShape, label: 'L-Shaped Boundary', icon: 'vector-polyline' },
              { s: 'irregular' as PlotShape, label: 'Irregular / Splayed', icon: 'vector-polygon' },
            ].map(({ s, label, icon }) => (
              <ChipCard
                key={s}
                value={s}
                active={form.plotShape === s}
                onToggle={() => upd('plotShape', s)}
                label={label}
                iconName={icon}
                theme={theme}
              />
            ))}
          </View>
          {form.plotShape === 'irregular' && (
            <TextInput
              value={form.plotShapeDesc}
              onChangeText={v => upd('plotShapeDesc', v)}
              placeholder="Specify boundary splay (e.g. 5ft corner chamfer, trapezoidal tapers at rear)..."
              placeholderTextColor={theme.outline}
              multiline
              numberOfLines={2}
              style={[styles.technicalInput, { borderColor: theme.primary, color: theme.onSurface, backgroundColor: theme.surfaceContainerLowest, marginTop: 8 }]}
            />
          )}

          <HairlineDivider theme={theme} />

          <FieldLabel help="Direction of plot frontage viewed outward toward the access road." theme={theme}>
            Primary Frontage Orientation (Azimuth Bearing) <Text style={{ color: theme.primary }}>*</Text>
          </FieldLabel>
          <View style={styles.compassGrid}>
            {[
              { v: 'north', label: 'North', short: 'N', bearing: '000°' },
              { v: 'northeast', label: 'N-East', short: 'NE', bearing: '045°' },
              { v: 'east', label: 'East', short: 'E', bearing: '090°' },
              { v: 'southeast', label: 'S-East', short: 'SE', bearing: '135°' },
              { v: 'south', label: 'South', short: 'S', bearing: '180°' },
              { v: 'southwest', label: 'S-West', short: 'SW', bearing: '225°' },
              { v: 'west', label: 'West', short: 'W', bearing: '270°' },
              { v: 'northwest', label: 'N-West', short: 'NW', bearing: '315°' },
            ].map(({ v, label, short, bearing }) => {
              const active = form.facing === v;
              return (
                <Pressable
                  key={v}
                  onPress={() => upd('facing', v as FacingDir)}
                  style={({ pressed }) => [
                    styles.compassCell,
                    {
                      borderColor: active ? theme.primary : theme.outlineVariant,
                      backgroundColor: active ? 'rgba(218,165,32,0.12)' : theme.surfaceContainerLowest,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.bearingCode, { color: active ? theme.primary : theme.onSurfaceVariant }]}>{bearing}</Text>
                  <Text style={[styles.bearingShort, { color: active ? theme.primary : theme.onSurface }]}>{short}</Text>
                  <Text numberOfLines={1} style={[styles.bearingLabel, { color: active ? theme.primary : theme.onSurfaceVariant }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <HairlineDivider theme={theme} />

          <FieldLabel theme={theme}>
            Road Ingress &amp; Frontage Access <Text style={{ color: theme.primary }}>*</Text>
          </FieldLabel>
          <View style={styles.grid2}>
            {[
              { v: 'front', l: 'Main Frontage Road' },
              { v: 'back', l: 'Secondary Rear Lane' },
              { v: 'left', l: 'Left Side Access' },
              { v: 'right', l: 'Right Side Access' },
            ].map(({ v, l }) => {
              const active = form.roadAccess.includes(v);
              const toggle = () => {
                const next = active ? form.roadAccess.filter(r => r !== v) : [...form.roadAccess, v];
                if (next.length > 0) upd('roadAccess', next);
              };
              return (
                <ChipCard
                  key={v}
                  value={v}
                  active={active}
                  onToggle={toggle}
                  label={l}
                  iconName="road-variant"
                  theme={theme}
                />
              );
            })}
          </View>

          <HairlineDivider theme={theme} />

          <FieldLabel help="Municipal right-of-way width controls required setbacks &amp; parking eligibility." theme={theme}>
            Road Right-of-Way Width
          </FieldLabel>
          <View style={styles.roadWidthWrap}>
            <TextInput
              value={form.roadWidth ? String(form.roadWidth) : ''}
              onChangeText={v => upd('roadWidth', Number(v) || 0)}
              keyboardType="numeric"
              placeholder="e.g. 24"
              placeholderTextColor={theme.outline}
              style={[styles.technicalInput, { flex: 1, color: theme.onSurface, backgroundColor: theme.surfaceContainerLowest, borderColor: theme.outlineVariant }]}
            />
            <View style={[styles.unitBadgeBox, { backgroundColor: theme.surfaceContainer, borderColor: theme.outlineVariant }]}>
              <Text style={[styles.unitBadgeText, { color: theme.onSurfaceVariant }]}>{form.plotUnit === 'feet' ? 'FT WIDTH' : 'M WIDTH'}</Text>
            </View>
          </View>
          {form.roadWidth > 0 && form.roadWidth < 12 && (
            <Notice type="warning" msg="Sub-standard road width (<12 ft). Municipal regulations may enforce restrictive setbacks for vehicular ingress." theme={theme} />
          )}
        </View>
      );
    }

    // STEP 01: Occupancy & Demographics
    if (curId === 1) {
      const totalResidents = form.adults + form.children + form.elders;
      return (
        <View>
          <SectionHead
            phase="Phase 02"
            stepNum={2}
            title="Occupancy & Lifestyle Program"
            sub="Determine family matrix, accessibility standards, and support accommodation."
            iconName="account-group-outline"
            theme={theme}
          />

          <View style={[styles.subCard, { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.outlineVariant }]}>
            <Text style={[styles.subCardTitle, { color: theme.primary }]}>RESIDENTIAL USER MATRIX</Text>
            <Stepper value={form.adults} onChange={(v: number) => upd('adults', v)} min={1} max={10} label="Adults (Age 18+)" theme={theme} />
            <HairlineDivider theme={theme} />
            <Stepper value={form.children} onChange={(v: number) => upd('children', v)} min={0} max={8} label="Minors & Dependents" theme={theme} />
            <HairlineDivider theme={theme} />
            <Stepper value={form.elders} onChange={(v: number) => upd('elders', v)} min={0} max={4} label="Senior Residents (Age 65+)" theme={theme} />
            <HairlineDivider theme={theme} />
            <View style={styles.metricSummaryRow}>
              <Text style={[styles.metricLabel, { color: theme.onSurfaceVariant }]}>Total Household Load:</Text>
              <Text style={[styles.metricValue, { color: theme.primary }]}>{totalResidents} Persons</Text>
            </View>
          </View>

          {form.elders > 0 && (
            <Notice type="info" msg="Universal accessibility protocol: Master / Senior bedroom automatically mapped to Ground Level." theme={theme} />
          )}

          <HairlineDivider theme={theme} />

          <View style={[styles.subCard, { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.outlineVariant }]}>
            <Text style={[styles.subCardTitle, { color: theme.primary }]}>DOMESTIC LOGISTICS &amp; SUPPORT</Text>
            <Toggle value={form.pets} onToggle={(v: boolean) => upd('pets', v)} label="Pet Friendly Provisioning" sub="Allots dedicated exterior wash bays, utility terraces, and perimeter yard." theme={theme} />
            <HairlineDivider theme={theme} />
            <Toggle value={form.domesticHelp} onToggle={(v: boolean) => upd('domesticHelp', v)} label="Domestic Support / Driver" sub="Requires ancillary utility space and secondary staff access." theme={theme} />
            {form.domesticHelp && (
              <View style={{ marginTop: 12, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: theme.primary }}>
                <Toggle value={form.servantQuarter} onToggle={(v: boolean) => upd('servantQuarter', v)} label="Staff Quarters &amp; Bath" sub="Self-contained unit separated from principal living areas." theme={theme} />
              </View>
            )}
          </View>

          <HairlineDivider theme={theme} />

          <View style={[styles.subCard, { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.outlineVariant }]}>
            <Text style={[styles.subCardTitle, { color: theme.primary }]}>VEHICULAR FLEET CAPACITY</Text>
            <Stepper
              value={form.cars}
              onChange={(v: number) => { upd('cars', v); upd('carParking', v > 0); }}
              min={0}
              max={4}
              label="Four-Wheelers (Cars)"
              theme={theme}
            />
            <HairlineDivider theme={theme} />
            <Stepper value={form.bikes} onChange={(v: number) => upd('bikes', v)} min={0} max={6} label="Two-Wheelers (Bikes / Scooters)" theme={theme} />
          </View>

          <HairlineDivider theme={theme} />

          <FieldLabel help="Frequent overnight guests will trigger a dedicated ensuite guest suite allocation." theme={theme}>
            Guest Hospitality Frequency
          </FieldLabel>
          {[
            { v: 'rarely', l: 'Occasional / Festive Only', s: 'Flex-use of living or convertible study room' },
            { v: 'occasionally', l: 'Monthly Recurring Guests', s: 'Semi-dedicated guest zone recommended' },
            { v: 'frequently', l: 'Frequent Extended Stays', s: 'Independent guest bedroom with dedicated ensuite bath' },
          ].map(({ v, l, s }) => (
            <RadioCard
              key={v}
              value={v}
              current={form.guestFreq}
              onPress={(val: any) => upd('guestFreq', val)}
              label={l}
              sub={s}
              iconName="bed-outline"
              theme={theme}
            />
          ))}
        </View>
      );
    }

    // STEP 02: Spatial Program & Verticality
    if (curId === 2) {
      return (
        <View>
          <SectionHead
            phase="Phase 03"
            stepNum={3}
            title="Spatial Schedule & Verticality"
            sub="Determine floor count, bedroom allotment, ensuite ratios, and circulation."
            iconName="floor-plan"
            theme={theme}
          />

          <FieldLabel theme={theme}>
            Building Massing / Floor Levels <Text style={{ color: theme.primary }}>*</Text>
          </FieldLabel>
          <SegCtrl
            value={String(form.stories)}
            onChange={(v: string) => {
              const s = Number(v) as Stories;
              upd('stories', s);
              upd('terraceAccess', s >= 2);
            }}
            options={[
              { value: '1', label: 'Ground (1 Storey)' },
              { value: '2', label: 'G + 1 (2 Floors)' },
              { value: '3', label: 'G + 2 (3 Floors)' },
              { value: '4', label: 'G + 3 (4 Floors)' },
            ]}
            theme={theme}
          />

          <HairlineDivider theme={theme} />

          <FieldLabel help={`Suggested for your household: ${Math.max(1, Math.ceil((form.adults + form.children) / 2))} Bedrooms`} theme={theme}>
            Total Bedroom Inventory <Text style={{ color: theme.primary }}>*</Text>
          </FieldLabel>
          <View style={[styles.subCard, { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.outlineVariant }]}>
            <Stepper
              value={form.bedrooms}
              onChange={(v: number) => upd('bedrooms', v)}
              min={1}
              max={Math.min(8, form.stories * 4)}
              label="Principal Bedrooms"
              theme={theme}
            />
          </View>
          {form.bedrooms > form.stories * 3 && (
            <Notice type="warning" msg={`Spatial density caution: ${form.bedrooms} bedrooms across ${form.stories} floor(s) may compromise minimum living room dimensions.`} theme={theme} />
          )}

          {form.bedrooms >= 2 && (
            <>
              <HairlineDivider theme={theme} />
              <FieldLabel theme={theme}>Master Bedroom Suite Specifications</FieldLabel>
              <View style={[styles.subCard, { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.outlineVariant }]}>
                {[
                  { k: 'mbAttachedBath' as const, l: 'Ensuite Master Bathroom' },
                  { k: 'mbWardrobe' as const, l: 'Walk-in Dressing Wardrobe' },
                  { k: 'mbStudy' as const, l: 'Integrated Study Alcove' },
                  { k: 'mbBalcony' as const, l: 'Private Balcony / Sit-out' },
                ].map(({ k, l }, i) => (
                  <View key={k}>
                    {i > 0 && <HairlineDivider theme={theme} />}
                    <Toggle value={form[k] as boolean} onToggle={(v: boolean) => upd(k, v)} label={l} theme={theme} />
                  </View>
                ))}
              </View>
            </>
          )}

          <HairlineDivider theme={theme} />

          <FieldLabel theme={theme}>Bathroom Allocation Protocol</FieldLabel>
          <RadioCard value="attached" current={form.bathPref} onPress={(v: any) => upd('bathPref', v)} label="100% Ensuite (Private to Every Bedroom)" sub="Maximum acoustic privacy and luxury convenience" iconName="shower" theme={theme} />
          <RadioCard value="shared" current={form.bathPref} onPress={(v: any) => upd('bathPref', v)} label="Shared / Common Wet Core" sub="Optimizes floor space and reduces MEP plumbing stacks" iconName="shower-head" theme={theme} />
          <RadioCard value="mix" current={form.bathPref} onPress={(v: any) => upd('bathPref', v)} label="Hybrid Configuration" sub="Ensuite for Master suites; shared for secondary bedrooms" iconName="water-pump" theme={theme} />

          <HairlineDivider theme={theme} />

          <FieldLabel theme={theme}>Ancillary Living Spaces</FieldLabel>
          <View style={[styles.subCard, { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.outlineVariant }]}>
            {[
              { k: 'livingRoom' as const, l: 'Formal Living Room', s: 'Main reception lounge' },
              { k: 'poojaRoom' as const, l: 'Dedicated Pooja Chamber', s: 'Auspicious meditative prayer corner' },
              { k: 'study' as const, l: 'Home Office / Library', s: 'Isolated focus workstation' },
              { k: 'storeRoom' as const, l: 'Pantry / Utility Store', s: 'Dry storage and linen supply room' },
            ].map(({ k, l, s }, i) => (
              <View key={k}>
                {i > 0 && <HairlineDivider theme={theme} />}
                <Toggle value={form[k] as boolean} onToggle={(v: boolean) => upd(k, v)} label={l} sub={s} theme={theme} />
              </View>
            ))}
          </View>

          <HairlineDivider theme={theme} />

          <FieldLabel theme={theme}>Dining Typology</FieldLabel>
          <View style={styles.grid2}>
            {[
              { v: 'separate', l: 'Enclosed Dining', i: 'silverware-fork-knife' },
              { v: 'open', l: 'Open-Plan Dining', i: 'table-furniture' },
              { v: 'in_kitchen', l: 'Kitchen Dining', i: 'stove' },
              { v: 'none', l: 'No Formal Dining', i: 'close-box-outline' },
            ].map(({ v, l, i }) => (
              <ChipCard key={v} value={v} active={form.dining === v} onToggle={() => upd('dining', v as DiningOpt)} label={l} iconName={i} theme={theme} />
            ))}
          </View>

          <HairlineDivider theme={theme} />

          <View style={[styles.subCard, { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.outlineVariant }]}>
            <Stepper value={form.balconies} onChange={(v: number) => upd('balconies', v)} min={0} max={4} label="Exterior Balconies / Sit-outs" theme={theme} />
            {form.stories >= 2 && (
              <>
                <HairlineDivider theme={theme} />
                <Toggle value={form.terraceAccess} onToggle={(v: boolean) => upd('terraceAccess', v)} label="Accessible Roof Terrace via Main Stair" sub="Includes reinforced parapet and staircase head-room" theme={theme} />
              </>
            )}
          </View>

          {form.stories >= 2 && (
            <>
              <HairlineDivider theme={theme} />
              <FieldLabel theme={theme}>Staircase Core Placement</FieldLabel>
              {[
                { v: 'center', l: 'Central Core Spine', s: 'Symmetrical distribution to peripheral zones', icon: 'stairs' },
                { v: 'side', l: 'Lateral Perimeter Core', s: 'Preserves unobstructed central floorplate', icon: 'stairs-up' },
                { v: 'entrance', l: 'Foyer / Lobby Stair', s: 'Direct access from entrance reception', icon: 'door-open' },
                { v: 'external', l: 'Exterior Staircase', s: 'Allows complete rental / tenant separation', icon: 'home-export-outline' },
              ].map(({ v, l, s, icon }) => (
                <RadioCard key={v} value={v} current={form.stairLoc} onPress={(val: any) => upd('stairLoc', val)} label={l} sub={s} iconName={icon} theme={theme} />
              ))}

              <HairlineDivider theme={theme} />

              <FieldLabel theme={theme}>Staircase Tread Width</FieldLabel>
              <SegCtrl
                value={form.stairWidth}
                onChange={(v: StairWidth) => upd('stairWidth', v)}
                options={[
                  { value: 'standard', label: '3.0 ft (Compact)' },
                  { value: 'comfortable', label: '3.5 ft (Recommended)' },
                  { value: 'wide', label: '4.0+ ft (Luxury)' },
                ]}
                theme={theme}
              />

              <HairlineDivider theme={theme} />

              <FieldLabel theme={theme}>Staircase Geometry</FieldLabel>
              <View style={styles.grid2}>
                {[
                  { v: 'straight', l: 'Straight Flight', icon: 'arrow-top-right' },
                  { v: 'l-shaped', l: 'Dog-Leg (L-Shape)', icon: 'arrow-decision' },
                  { v: 'u-shaped', l: 'Open-Well (U-Shape)', icon: 'subdirectory-arrow-right' },
                  { v: 'spiral', l: 'Helical / Spiral', icon: 'rotate-right' },
                ].map(({ v, l, icon }) => (
                  <ChipCard key={v} value={v} active={form.stairShape === v} onToggle={() => upd('stairShape', v as StairShape)} label={l} iconName={icon} theme={theme} />
                ))}
              </View>
              {form.stairShape === 'spiral' && form.elders > 0 && (
                <Notice type="warning" msg="Safety alert: Spiral stairs present ergonomic barriers for senior residents. Consider L-shaped dog-leg flight." theme={theme} />
              )}
            </>
          )}
        </View>
      );
    }

    // STEP 03: Kitchen & Dining Services
    if (curId === 3) {
      return (
        <View>
          <SectionHead
            phase="Phase 04"
            stepNum={4}
            title="Culinary & Wet Services Program"
            sub="Determine kitchen zoning, appliance integration, and dining capacity."
            iconName="countertop-outline"
            theme={theme}
          />

          <FieldLabel theme={theme}>Kitchen Spatial Typology <Text style={{ color: theme.primary }}>*</Text></FieldLabel>
          <View style={styles.grid2}>
            {[
              { v: 'closed', l: 'Enclosed Kitchen', sub: 'Odor & noise containment', icon: 'door' },
              { v: 'open', l: 'Open-Concept', sub: 'Social integration', icon: 'view-dashboard-outline' },
              { v: 'island', l: 'Island Worktop', sub: 'High-end prep counter', icon: 'island' },
              { v: 'semi-open', l: 'Semi-Open Partition', sub: 'Acoustic visual balance', icon: 'window-closed-variant' },
            ].map(({ v, l, sub, icon }) => (
              <ChipCard key={v} value={v} active={form.kitchenType === v} onToggle={() => upd('kitchenType', v as KitchenType)} label={l} subtitle={sub} iconName={icon} theme={theme} />
            ))}
          </View>

          <HairlineDivider theme={theme} />

          <FieldLabel theme={theme}>Integrated Culinary Fixtures &amp; MEP</FieldLabel>
          <View style={styles.grid2}>
            {[
              'Modular Cabinetry', 'Double-Bowl Sink', 'Dishwasher MEP Stub',
              'Built-in Refrigerator', 'High-CFM Chimney', 'U-Shaped Counter',
              'L-Shaped Counter', 'Direct Wet Yard Access'
            ].map(feat => {
              const active = form.kitchenFeatures.includes(feat);
              return (
                <ChipCard
                  key={feat}
                  value={feat}
                  active={active}
                  onToggle={() => {
                    const next = active ? form.kitchenFeatures.filter(f => f !== feat) : [...form.kitchenFeatures, feat];
                    upd('kitchenFeatures', next);
                  }}
                  label={feat}
                  iconName="check-decagram-outline"
                  theme={theme}
                />
              );
            })}
          </View>

          <HairlineDivider theme={theme} />

          <FieldLabel theme={theme}>Dining Table Capacity</FieldLabel>
          <SegCtrl
            value={form.diningCapacity}
            onChange={(v: any) => upd('diningCapacity', v)}
            options={[
              { value: '4', label: '4-Seater' },
              { value: '6', label: '6-Seater' },
              { value: '8', label: '8-Seater' },
              { value: '10+', label: '10+ Banquet' },
            ]}
            theme={theme}
          />
        </View>
      );
    }

    // STEP 04: Vehicular Logistics
    if (curId === 4) {
      return (
        <View>
          <SectionHead
            phase="Phase 05"
            stepNum={5}
            title="Vehicular Logistics & Parking Bay"
            sub="Structural garage specifications based on vehicle clearances and frontage ingress."
            iconName="garage-variant"
            theme={theme}
          />

          <View style={[styles.subCard, { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.outlineVariant }]}>
            <Text style={[styles.subCardTitle, { color: theme.primary }]}>PARKING ALLOTMENT</Text>
            <Stepper value={form.cars} onChange={(v: number) => { upd('cars', v); upd('carParking', v > 0); }} min={0} max={4} label="Covered Car Bays" theme={theme} />
            <HairlineDivider theme={theme} />
            <Stepper value={form.bikes} onChange={(v: number) => upd('bikes', v)} min={0} max={6} label="Motorcycle / Scooter Bays" theme={theme} />
          </View>

          <HairlineDivider theme={theme} />

          <View style={[styles.subCard, { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.outlineVariant }]}>
            <Toggle
              value={form.carParking}
              onToggle={(v: boolean) => upd('carParking', v)}
              label="Designate Dedicated Parking Bay"
              sub="Incorporates turning radii, apron clearances, and structural portal frames."
              theme={theme}
            />
          </View>

          {form.carParking && (
            <>
              <HairlineDivider theme={theme} />
              <FieldLabel theme={theme}>Structural Parking Configuration</FieldLabel>
              {[
                { v: 'open', l: 'Paved Surface Bay (Open-Air)', s: 'Minimal footprint, pervious paver drainage', icon: 'weather-sunny' },
                { v: 'covered', l: 'Cantilevered Portico / Pergola', s: 'Overhead solar protection with architectural canopy', icon: 'shield-car' },
                { v: 'garage', l: 'Enclosed Lockable Garage Box', s: 'Motorized roller shutter, tool storage, EV charging', icon: 'garage' },
                { v: 'stilt', l: 'Stilt Ground Podium Floor', s: 'Elevated superstructure with column-free parking beneath', icon: 'pillar' },
              ].map(({ v, l, s, icon }) => (
                <RadioCard
                  key={v}
                  value={v}
                  current={form.parkingType}
                  onPress={(val: any) => upd('parkingType', val)}
                  label={l}
                  sub={v === 'garage' && form.roadWidth < 12 ? `Caution: Narrow road (${form.roadWidth}ft) may restrict garage turning radius` : s}
                  iconName={icon}
                  theme={theme}
                />
              ))}
            </>
          )}
        </View>
      );
    }

    // STEP 05: Vastu Shastra Orientation
    if (curId === 5) {
      return (
        <View>
          <SectionHead
            phase="Phase 06"
            stepNum={6}
            title="Vastu Mandala Alignment"
            sub="Climatic orientation, cardinal elemental zones (Pancha Bhootas), and quadrant audits."
            iconName="compass-rose"
            theme={theme}
          />

          <View style={[styles.subCard, { backgroundColor: form.vastuEnabled ? 'rgba(218,165,32,0.08)' : theme.surfaceContainerLowest, borderColor: form.vastuEnabled ? theme.primary : theme.outlineVariant }]}>
            <Toggle
              value={form.vastuEnabled}
              onToggle={(v: boolean) => upd('vastuEnabled', v)}
              label="Enforce Vastu Shastra Compliance"
              sub="Applies Vedic spatial zoning across cardinal and inter-cardinal quadrants."
              theme={theme}
            />
          </View>

          {form.vastuEnabled && (
            <>
              <HairlineDivider theme={theme} />
              <FieldLabel theme={theme}>Compliance Tolerance Level</FieldLabel>
              <SegCtrl
                value={form.vastuStrictness}
                onChange={(v: VastuStrict) => upd('vastuStrictness', v)}
                options={[
                  { value: 'strict', label: 'Strict (100%)' },
                  { value: 'balanced', label: 'Balanced (Core)' },
                  { value: 'flexible', label: 'Ergonomic 1st' },
                ]}
                theme={theme}
              />
              <Text style={[styles.fieldHelp, { color: theme.onSurfaceVariant, marginTop: 8 }]}>
                {form.vastuStrictness === 'strict'
                  ? 'All room allocations must strictly conform to Vedic grid coordinates.'
                  : form.vastuStrictness === 'balanced'
                  ? 'Critical zones (Kitchen in SE, Master in SW, Pooja in NE) enforced.'
                  : 'Prioritizes functional daylighting and spatial comfort while respecting basic cardinal rules.'}
              </Text>

              <HairlineDivider theme={theme} />

              <FieldLabel theme={theme}>Mandatory Quadrant Directives</FieldLabel>
              {[
                { v: 'kitchen_southeast', l: 'Agni (SE): Kitchen & Cooking Platform' },
                { v: 'master_southwest', l: 'Nirruthi (SW): Master Bed Zone' },
                { v: 'entrance_north_east', l: 'Ishanya (NE) / Vayu (NW): Main Entrance' },
                { v: 'pooja_northeast', l: 'Ishanya (NE): Sacred Shrine Alcove' },
                { v: 'toilets_northwest', l: 'Vayu (NW): Wet Waste Plumbing' },
                { v: 'avoid_major', l: 'Brahmasthan: Preserve open central core' },
              ].map(({ v, l }) => {
                const active = form.vastuReqs.includes(v);
                return (
                  <ChipCard
                    key={v}
                    value={v}
                    active={active}
                    fullWidth
                    onToggle={() => {
                      const next = active ? form.vastuReqs.filter(r => r !== v) : [...form.vastuReqs, v];
                      upd('vastuReqs', next);
                    }}
                    label={l}
                    iconName="compass"
                    theme={theme}
                  />
                );
              })}
            </>
          )}
        </View>
      );
    }

    // STEP 06: Architectural Typology & Style
    if (curId === 6) {
      return (
        <View>
          <SectionHead
            phase="Phase 07"
            stepNum={7}
            title="Architectural Envelope & Typology"
            sub="Select design language, fenestration ratios, and finish specifications."
            iconName="home-modern"
            theme={theme}
          />

          <FieldLabel theme={theme}>Architectural Style Language</FieldLabel>
          {[
            { v: 'contemporary', l: 'Contemporary / Modernist', s: 'Crisp cantilevers, flat roofs, floor-to-ceiling fenestration', icon: 'cube-outline' },
            { v: 'traditional', l: 'Traditional Vernacular', s: 'Sloped Mangalore tile gables, wooden verandah posts, courtyard core', icon: 'home-roof' },
            { v: 'eco', l: 'Bioclimatic / Sustainable', s: 'Exposed compressed earth blocks, passive stack ventilation', icon: 'leaf' },
            { v: 'mediterranean', l: 'Mediterranean Villa', s: 'Archways, textured stucco, terracotta pergolas, warm earth tones', icon: 'castle' },
            { v: 'minimalist', l: 'Brutalist / Minimalist', s: 'Board-formed concrete, geometric purity, concealed trim detailing', icon: 'shape-outline' },
          ].map(({ v, l, s, icon }) => (
            <RadioCard
              key={v}
              value={v}
              current={form.archStyle}
              onPress={(val: any) => upd('archStyle', val)}
              label={l}
              sub={s}
              iconName={icon}
              theme={theme}
            />
          ))}

          <HairlineDivider theme={theme} />

          <FieldLabel theme={theme}>Specification &amp; Finish Grade</FieldLabel>
          <View style={styles.grid2}>
            {[
              { v: 'economy', l: 'Standard Grade', sub: 'Cost-efficient' },
              { v: 'standard', l: 'Executive Grade', sub: 'Premium vitrified' },
              { v: 'premium', l: 'Bespoke Grade', sub: 'Italian marble' },
              { v: 'luxury', l: 'Super-Luxury', sub: 'Imported stone' },
            ].map(({ v, l, sub }) => (
              <ChipCard
                key={v}
                value={v}
                active={form.finish === v}
                onToggle={() => upd('finish', v as FinishQ)}
                label={l}
                subtitle={sub}
                iconName="medal-outline"
                theme={theme}
              />
            ))}
          </View>

          <HairlineDivider theme={theme} />

          <FieldLabel theme={theme}>Fenestration &amp; Daylighting Ratio</FieldLabel>
          <SegCtrl
            value={form.windowPref}
            onChange={(v: WinPref) => upd('windowPref', v)}
            options={[
              { value: 'small', label: 'Punched (<15%)' },
              { value: 'moderate', label: 'Balanced (20-30%)' },
              { value: 'large', label: 'Large (40%+)' },
            ]}
            theme={theme}
          />

          <HairlineDivider theme={theme} />

          <View style={[styles.subCard, { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.outlineVariant }]}>
            <Toggle
              value={form.futureExpansion}
              onToggle={(v: boolean) => upd('futureExpansion', v)}
              label="Design for Vertical Future Expansion"
              sub="Reinforces foundation footings, rebar starter dowels, and column load sizing for additional storeys."
              theme={theme}
            />
          </View>
        </View>
      );
    }

    // STEP 07: Site Constraints & Context
    if (curId === 7) {
      return (
        <View>
          <SectionHead
            phase="Phase 08"
            stepNum={8}
            title="Site Context & Topographical Constraints"
            sub="Register existing on-site infrastructure, adjoining shared party walls, and site slope."
            iconName="map-marker-radius-outline"
            theme={theme}
          />

          <FieldLabel help="Indicate structures that must be preserved or integrated into the plan." theme={theme}>
            Existing On-Site Physical Features
          </FieldLabel>
          <View style={styles.grid2}>
            {([
              { v: 'borewell', l: 'Active Borewell Rig', i: 'water-well' },
              { v: 'septic_tank', l: 'Septic Tank', i: 'tank' },
              { v: 'trees', l: 'Mature Trees', i: 'tree' },
              { v: 'old_structure', l: 'Old Structure', i: 'wall' },
              { v: 'water_tank', l: 'Water Sump', i: 'water' },
              { v: 'electric_pole', l: 'Overhead Pole', i: 'transmission-tower' },
              { v: 'drainage', l: 'Storm Drain', i: 'pipe-leak' },
            ] as { v: ExistFeat; l: string; i: string }[]).map(({ v, l, i }) => {
              const active = form.existingFeatures.some(f => f.feature === v);
              const toggle = () => {
                const next = active
                  ? form.existingFeatures.filter(f => f.feature !== v)
                  : [...form.existingFeatures, { feature: v, location: '' }];
                upd('existingFeatures', next);
              };
              return <ChipCard key={v} value={v} active={active} onToggle={toggle} label={l} iconName={i} theme={theme} />;
            })}
          </View>

          {form.existingFeatures.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.fieldLabel, { color: theme.onSurface, marginBottom: 8 }]}>Feature Locations:</Text>
              {form.existingFeatures.map(item => (
                <View key={item.feature} style={[styles.locationInputRow, { borderColor: theme.outlineVariant, backgroundColor: theme.surfaceContainerLowest }]}>
                  <Text style={[styles.locationBadge, { color: theme.primary }]}>{item.feature.toUpperCase()}</Text>
                  <TextInput
                    value={item.location}
                    onChangeText={v => {
                      const next = form.existingFeatures.map(f => f.feature === item.feature ? { ...f, location: v } : f);
                      upd('existingFeatures', next);
                    }}
                    placeholder="e.g. NE Corner, 4ft offset"
                    placeholderTextColor={theme.outline}
                    style={[styles.technicalInputInline, { color: theme.onSurface }]}
                  />
                </View>
              ))}
            </View>
          )}

          <HairlineDivider theme={theme} />

          <FieldLabel help="Select sides where adjoining structures block natural daylight or cross ventilation." theme={theme}>
            Adjacent Abutting Structures / Party Walls
          </FieldLabel>
          <View style={styles.compassGrid}>
            {[
              { v: 'north', label: 'North Wall' },
              { v: 'east', label: 'East Wall' },
              { v: 'south', label: 'South Wall' },
              { v: 'west', label: 'West Wall' },
            ].map(({ v, label }) => {
              const active = form.neighborSides.includes(v);
              return (
                <Pressable
                  key={v}
                  onPress={() => {
                    const next = active ? form.neighborSides.filter(s => s !== v) : [...form.neighborSides, v];
                    upd('neighborSides', next);
                  }}
                  style={({ pressed }) => [
                    styles.compassCell,
                    {
                      borderColor: active ? theme.primary : theme.outlineVariant,
                      backgroundColor: active ? 'rgba(218,165,32,0.12)' : theme.surfaceContainerLowest,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={active ? 'wall' : 'wall-sconce-flat'}
                    size={18}
                    color={active ? theme.primary : theme.onSurfaceVariant}
                  />
                  <Text style={[styles.bearingLabel, { color: active ? theme.primary : theme.onSurface, marginTop: 4 }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <HairlineDivider theme={theme} />

          <FieldLabel theme={theme}>Site Topography &amp; Gradient</FieldLabel>
          {[
            { v: 'flat', l: 'Level Grade (Flat Site)', s: 'Minimal earthwork, standard shallow strip foundations', icon: 'vector-line' },
            { v: 'toward_road', l: 'Positive Slope (Inclines Toward Road)', s: 'Natural gravity stormwater drainage toward municipal swale', icon: 'trending-up' },
            { v: 'away_road', l: 'Depressed Grade (Slopes Away from Road)', s: 'May require stepped foundation or plinth retaining wall', icon: 'trending-down' },
            { v: 'side', l: 'Cross Slope (Lateral Gradient)', s: 'Terraced split-level planning recommended', icon: 'unfold-more-horizontal' },
          ].map(({ v, l, s, icon }) => (
            <RadioCard
              key={v}
              value={v}
              current={form.siteSlope}
              onPress={(val: any) => upd('siteSlope', val)}
              label={l}
              sub={s}
              iconName={icon}
              theme={theme}
            />
          ))}
        </View>
      );
    }

    // STEP 08: Specifications & Remarks
    if (curId === 8) {
      return (
        <View>
          <SectionHead
            phase="Phase 09"
            stepNum={9}
            title="Design Directives &amp; Structural Remarks"
            sub="Submit final brief directives, specialized acoustical requests, or architectural exclusions."
            iconName="clipboard-text-outline"
            theme={theme}
          />

          <FieldLabel theme={theme}>Special Architectural Directives</FieldLabel>
          <Text style={[styles.fieldHelp, { color: theme.onSurfaceVariant, marginBottom: 8 }]}>
            High ceilings, double-height cutouts, acoustical insulation, home theater specifications, rainwater harvesting...
          </Text>
          <View style={{ position: 'relative' }}>
            <TextInput
              value={form.specialNotes}
              onChangeText={v => { if (v.length <= 500) upd('specialNotes', v); }}
              placeholder="e.g. Double-height living room cutout with skylight; dedicated home theater room..."
              placeholderTextColor={theme.outline}
              multiline
              numberOfLines={4}
              maxLength={500}
              style={[styles.technicalTextarea, { borderColor: theme.outlineVariant, color: theme.onSurface, backgroundColor: theme.surfaceContainerLowest }]}
            />
            <Text style={[styles.charCounter, { color: form.specialNotes.length > 450 ? '#F59E0B' : theme.onSurfaceVariant }]}>
              {form.specialNotes.length}/500
            </Text>
          </View>

          <HairlineDivider theme={theme} />

          <FieldLabel theme={theme}>Negative Directives (Exclusions)</FieldLabel>
          <Text style={[styles.fieldHelp, { color: theme.onSurfaceVariant, marginBottom: 8 }]}>
            Features explicitly excluded from the design (e.g. no spiral stairs, no zero-setback party walls, no exposed open kitchens)...
          </Text>
          <View style={{ position: 'relative' }}>
            <TextInput
              value={form.avoidNotes}
              onChangeText={v => { if (v.length <= 300) upd('avoidNotes', v); }}
              placeholder="e.g. Strictly no spiral stairs; no open kitchens visible from main entrance foyer..."
              placeholderTextColor={theme.outline}
              multiline
              numberOfLines={3}
              maxLength={300}
              style={[styles.technicalTextarea, { borderColor: theme.outlineVariant, color: theme.onSurface, backgroundColor: theme.surfaceContainerLowest }]}
            />
            <Text style={[styles.charCounter, { color: form.avoidNotes.length > 270 ? '#F59E0B' : theme.onSurfaceVariant }]}>
              {form.avoidNotes.length}/300
            </Text>
          </View>

          <HairlineDivider theme={theme} />

          <View style={[styles.blueprintReadyStamp, { borderColor: 'rgba(218,165,32,0.3)', backgroundColor: isDark ? 'rgba(218,165,32,0.06)' : 'rgba(218,165,32,0.08)' }]}>
            <View style={[styles.stampIconRing, { borderColor: theme.primary }]}>
              <MaterialCommunityIcons name="check-bold" size={18} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.stampTitle, { color: theme.onSurface }]}>PROGRAMMING COMPLETE</Text>
              <Text style={[styles.stampSub, { color: theme.onSurfaceVariant }]}>
                All 9 phases parameterized. Ready to synthesize BIM structural draft and floor layout.
              </Text>
              {/* Synthesis Output Selector */}
              <Text style={[styles.fieldLabel, { color: theme.onSurface, marginTop: 16, marginBottom: 8 }]}>
                SELECT SYNTHESIS OUTPUT FORMAT
              </Text>
              <View style={{ gap: 8, marginBottom: 14 }}>
                <RadioCard
                  value="both"
                  current={outputMode}
                  onPress={setOutputMode}
                  label="2D + 3D Complete Bundle"
                  sub="Both CAD drafting blueprint & photorealistic 3D interior cutaway"
                  iconName="layers-triple-outline"
                  theme={theme}
                />
                <RadioCard
                  value="2d"
                  current={outputMode}
                  onPress={setOutputMode}
                  label="2D House Plan Only"
                  sub="Orthographic CAD blueprint with dimensions, setbacks & room layout"
                  iconName="ruler-square-compass"
                  theme={theme}
                />
                <RadioCard
                  value="3d"
                  current={outputMode}
                  onPress={setOutputMode}
                  label="3D House Plan Only"
                  sub="Isometric 3D architectural cutaway model with materials & depth"
                  iconName="cube-outline"
                  theme={theme}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                <Pressable
                  onPress={copyJsonToClipboard}
                  style={({ pressed }) => [styles.phaseCopyBtn, { borderColor: copied ? '#22c55e' : theme.outlineVariant, opacity: pressed ? 0.75 : 1 }]}
                >
                  <MaterialCommunityIcons name={copied ? 'check' : 'content-copy'} size={15} color={copied ? '#22c55e' : theme.primary} />
                  <Text style={[styles.phaseCopyBtnText, { color: copied ? '#22c55e' : theme.primary }]}>
                    {copied ? 'Copied' : 'Copy JSON'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      );
    }

    return null;
  };

  // ─── Loading / Generation Animation View ──
  if (isGenerating) {
    return (
      <HousePlanLoadingAnimation
        theme={theme}
        isDark={isDark}
        formData={form}
        onComplete={() => {
          setIsGenerating(false);
          setSubmitted(true);
          scrollRef.current?.scrollTo({ y: 0, animated: true });
        }}
        onViewPlan={() => {
          setIsGenerating(false);
          setSubmitted(true);
          scrollRef.current?.scrollTo({ y: 0, animated: true });
        }}
      />
    );
  }

  // ─── Submitted / Plan Preview (Architectural Title Block Sheet) ──
  if (submitted) {
    const json = buildJson();
    const jsonStr = JSON.stringify(json, null, 2);
    const grossArea = form.plotUnit === 'feet' ? form.plotWidth * form.plotDepth : Math.round(form.plotWidth * form.plotDepth * 10.7639);

    return (
      <View style={[styles.root, { backgroundColor: theme.surface }]}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: isSmallMobile ? 10 : isWide ? 24 : 14, paddingBottom: 60 },
            isWide && { maxWidth: 960, alignSelf: 'center', width: '100%' },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Bar */}
          <View style={styles.topNavRow}>
            <Pressable
              onPress={() => router.back()}
              style={[styles.roundBackBtn, { borderColor: theme.outlineVariant, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF' }]}
            >
              <MaterialIcons name="arrow-back" size={18} color={theme.onSurface} />
            </Pressable>

            <View style={styles.statusChipGroup}>
              <View style={[styles.technicalStatusPill, { borderColor: 'rgba(34,197,94,0.4)', backgroundColor: 'rgba(34,197,94,0.1)' }]}>
                <View style={[styles.pulseBeacon, { backgroundColor: '#22c55e' }]} />
                <Text style={{ color: '#22c55e', fontSize: 10.5, fontWeight: '700', letterSpacing: 0.5 }}>SYNTHESIS COMPLETE</Text>
              </View>
            </View>
          </View>

          {/* ─── AI Synthesized 2D & 3D Floor Plan Visual Gallery ─── */}
          {(plan2dUrl || plan3dUrl || isAiGenerating) && (
            <View style={[styles.galleryContainer, { borderColor: isDark ? 'rgba(218,165,32,0.3)' : theme.outlineVariant, backgroundColor: isDark ? '#0A1220' : '#FFFFFF' }]}>
              <View style={styles.galleryHeaderRow}>
                <View style={{ flex: 1 }}>
                  <View style={[styles.galleryBadge, { backgroundColor: 'rgba(218,165,32,0.1)', borderColor: theme.primary }]}>
                    <MaterialCommunityIcons name="floor-plan" size={13} color={theme.primary} />
                    <Text style={[styles.galleryBadgeText, { color: theme.primary }]}>AI ARCHITECTURAL SYNTHESIS</Text>
                  </View>
                  <Text style={[styles.galleryMainTitle, { color: theme.onSurface }]}>2D & 3D Floor Plan Visualization</Text>
                  <Text style={[styles.gallerySubTitle, { color: theme.onSurfaceVariant }]}>
                    Separate orthographic CAD drawing & matching isometric cutaway (Interior layout only)
                  </Text>
                </View>


              </View>

              <HairlineDivider theme={theme} />

              {/* Grid of 2D and 3D Cards */}
              <View style={[styles.plansGrid, { flexDirection: isWide && (outputMode === 'both' || (plan2dUrl && plan3dUrl)) ? 'row' : 'column' }]}>
                {/* 2D Plan Card */}
                {(outputMode === 'both' || outputMode === '2d' || (plan2dUrl && !plan3dUrl)) && (
                  <View style={[styles.planCard, isWide && (outputMode === 'both' || (plan2dUrl && plan3dUrl)) && { flex: 1 }, { borderColor: theme.outlineVariant, backgroundColor: isDark ? '#070D18' : '#F8FAFC' }]}>
                    <View style={styles.cardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <MaterialCommunityIcons name="ruler-square-compass" size={16} color={theme.primary} />
                        <Text style={[styles.cardTitle, { color: theme.onSurface }]}>PHASE 3: 2D ARCHITECTURAL FLOOR PLAN</Text>
                      </View>
                      <View style={[styles.cadTag, { borderColor: 'rgba(34,197,94,0.4)', backgroundColor: 'rgba(34,197,94,0.1)' }]}>
                        <Text style={{ fontSize: 9.5, fontWeight: '700', color: '#22c55e' }}>TOP-DOWN ORTHOGRAPHIC</Text>
                      </View>
                    </View>

                    {plan2dUrl ? (
                      <Pressable onPress={() => setFullscreenImage(plan2dUrl)}>
                        <Image
                          source={{ uri: resolveImageUrl(plan2dUrl) || plan2dUrl }}
                          style={styles.planImage}
                          resizeMode="contain"
                        />
                      </Pressable>
                    ) : (
                      <View style={[styles.imagePlaceholder, { backgroundColor: isDark ? '#040710' : '#E2E8F0' }]}>
                        <ActivityIndicator color={theme.primary} size="large" />
                        <Text style={[styles.placeholderText, { color: theme.onSurfaceVariant }]}>Synthesizing 2D CAD Layout...</Text>
                      </View>
                    )}

                    <View style={styles.cardFooter}>
                      <Text style={[styles.cardFootnote, { color: theme.onSurfaceVariant }]}>
                        Rooms, wall linework, door arcs, dimensions & schedule
                      </Text>
                      {plan2dUrl && (
                        <Pressable
                          onPress={() => downloadPlanImage(plan2dUrl, `house_plan_2d_${form.plotWidth}x${form.plotDepth}.png`)}
                          style={[styles.planDownloadBtn, { borderColor: theme.primary }]}
                        >
                          <MaterialCommunityIcons name="download" size={13} color={theme.primary} />
                          <Text style={[styles.planDownloadText, { color: theme.primary }]}>Download 2D</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                )}

                {/* 3D Visualization Card */}
                {(outputMode === 'both' || outputMode === '3d' || (plan3dUrl && !plan2dUrl)) && (
                  <View style={[styles.planCard, isWide && (outputMode === 'both' || (plan2dUrl && plan3dUrl)) && { flex: 1 }, { borderColor: theme.outlineVariant, backgroundColor: isDark ? '#070D18' : '#F8FAFC' }]}>
                    <View style={styles.cardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <MaterialCommunityIcons name="cube-outline" size={16} color={theme.primary} />
                        <Text style={[styles.cardTitle, { color: theme.onSurface }]}>PHASE 4: 3D CUTAWAY VISUALIZATION</Text>
                      </View>
                      <View style={[styles.cadTag, { borderColor: 'rgba(218,165,32,0.4)', backgroundColor: 'rgba(218,165,32,0.1)' }]}>
                        <Text style={{ fontSize: 9.5, fontWeight: '700', color: theme.primary }}>ISOMETRIC CUTAWAY</Text>
                      </View>
                    </View>

                    {plan3dUrl ? (
                      <Pressable onPress={() => setFullscreenImage(plan3dUrl)}>
                        <Image
                          source={{ uri: resolveImageUrl(plan3dUrl) || plan3dUrl }}
                          style={styles.planImage}
                          resizeMode="contain"
                        />
                      </Pressable>
                    ) : (
                      <View style={[styles.imagePlaceholder, { backgroundColor: isDark ? '#040710' : '#E2E8F0' }]}>
                        <ActivityIndicator color={theme.primary} size="large" />
                        <Text style={[styles.placeholderText, { color: theme.onSurfaceVariant }]}>Rendering 3D Isometric Cutaway...</Text>
                      </View>
                    )}

                    <View style={styles.cardFooter}>
                      <Text style={[styles.cardFootnote, { color: theme.onSurfaceVariant }]}>
                        Derived geometry, materials, furniture & lighting (No exterior)
                      </Text>
                      {plan3dUrl && (
                        <Pressable
                          onPress={() => downloadPlanImage(plan3dUrl, `house_plan_3d_${form.plotWidth}x${form.plotDepth}.png`)}
                          style={[styles.planDownloadBtn, { borderColor: theme.primary }]}
                        >
                          <MaterialCommunityIcons name="download" size={13} color={theme.primary} />
                          <Text style={[styles.planDownloadText, { color: theme.primary }]}>Download 3D</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                )}
              </View>

              {/* Executive Design Summary from AI */}
              {designSummary && (
                <View style={[styles.designSummaryBox, { borderColor: theme.outlineVariant, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F1F5F9' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <MaterialCommunityIcons name="text-box-check-outline" size={16} color={theme.primary} />
                    <Text style={[styles.summaryTitle, { color: theme.onSurface }]}>Phase 6: Architectural Executive Summary</Text>
                  </View>
                  <Text style={[styles.summaryBody, { color: theme.onSurfaceVariant }]}>{designSummary}</Text>
                </View>
              )}
            </View>
          )}

          {/* Architectural Blueprint Title Block */}
          <View style={[styles.titleBlockContainer, { borderColor: isDark ? 'rgba(218,165,32,0.3)' : theme.outlineVariant, backgroundColor: isDark ? '#0A1220' : '#FFFFFF' }]}>
            <View style={styles.titleBlockHeader}>
              <View style={styles.titleBlockIdentity}>
                <Text style={[styles.firmSub, { color: theme.primary }]}>BOOLOK ARCHITECTURAL STUDIO</Text>
                <Text style={[styles.sheetTitle, { color: theme.onSurface }]}>PROJECT DESIGN BRIEF</Text>
              </View>
              <View style={[styles.refBox, { borderColor: theme.outlineVariant }]}>
                <Text style={[styles.refLabel, { color: theme.onSurfaceVariant }]}>DOC REF</Text>
                <Text style={[styles.refCode, { color: theme.onSurface }]}>ARC-2026</Text>
              </View>
            </View>

            <HairlineDivider theme={theme} />

            {/* Technical Specification Schedule Matrix */}
            <View style={styles.specSchedule}>
              <View style={styles.scheduleCol}>
                <Text style={[styles.colHeading, { color: theme.primary }]}>SITE &amp; BOUNDARY DATA</Text>
                <View style={styles.scheduleRow}>
                  <Text style={[styles.scheduleKey, { color: theme.onSurfaceVariant }]}>Plot Boundary:</Text>
                  <Text style={[styles.scheduleVal, { color: theme.onSurface }]}>{form.plotWidth} × {form.plotDepth} {form.plotUnit}</Text>
                </View>
                <View style={styles.scheduleRow}>
                  <Text style={[styles.scheduleKey, { color: theme.onSurfaceVariant }]}>Gross Footprint:</Text>
                  <Text style={[styles.scheduleVal, { color: theme.onSurface }]}>{grossArea.toLocaleString()} sq.ft</Text>
                </View>
                <View style={styles.scheduleRow}>
                  <Text style={[styles.scheduleKey, { color: theme.onSurfaceVariant }]}>Orientation:</Text>
                  <Text style={[styles.scheduleVal, { color: theme.onSurface }]}>{form.facing.toUpperCase()}</Text>
                </View>
                <View style={styles.scheduleRow}>
                  <Text style={[styles.scheduleKey, { color: theme.onSurfaceVariant }]}>Access Road:</Text>
                  <Text style={[styles.scheduleVal, { color: theme.onSurface }]}>{form.roadWidth} {form.plotUnit}</Text>
                </View>
              </View>

              <View style={styles.scheduleCol}>
                <Text style={[styles.colHeading, { color: theme.primary }]}>SPATIAL ALLOCATION</Text>
                <View style={styles.scheduleRow}>
                  <Text style={[styles.scheduleKey, { color: theme.onSurfaceVariant }]}>Vertical Massing:</Text>
                  <Text style={[styles.scheduleVal, { color: theme.onSurface }]}>{form.stories === 1 ? 'Ground Only' : `G + ${form.stories - 1}`}</Text>
                </View>
                <View style={styles.scheduleRow}>
                  <Text style={[styles.scheduleKey, { color: theme.onSurfaceVariant }]}>Program:</Text>
                  <Text style={[styles.scheduleVal, { color: theme.onSurface }]}>{form.bedrooms} BHK ({form.bathPref})</Text>
                </View>
                <View style={styles.scheduleRow}>
                  <Text style={[styles.scheduleKey, { color: theme.onSurfaceVariant }]}>Kitchen:</Text>
                  <Text style={[styles.scheduleVal, { color: theme.onSurface }]}>{form.kitchenType.toUpperCase()}</Text>
                </View>
                <View style={styles.scheduleRow}>
                  <Text style={[styles.scheduleKey, { color: theme.onSurfaceVariant }]}>Parking Bay:</Text>
                  <Text style={[styles.scheduleVal, { color: theme.onSurface }]}>{form.carParking ? `${form.cars} Car (${form.parkingType})` : 'None'}</Text>
                </View>
              </View>
            </View>

            <HairlineDivider theme={theme} />

            <View style={styles.specSchedule}>
              <View style={styles.scheduleCol}>
                <Text style={[styles.colHeading, { color: theme.primary }]}>DIRECTIVES</Text>
                <View style={styles.scheduleRow}>
                  <Text style={[styles.scheduleKey, { color: theme.onSurfaceVariant }]}>Vastu:</Text>
                  <Text style={[styles.scheduleVal, { color: theme.onSurface }]}>{form.vastuEnabled ? form.vastuStrictness.toUpperCase() : 'EXEMPT'}</Text>
                </View>
                <View style={styles.scheduleRow}>
                  <Text style={[styles.scheduleKey, { color: theme.onSurfaceVariant }]}>Expansion:</Text>
                  <Text style={[styles.scheduleVal, { color: theme.onSurface }]}>{form.futureExpansion ? 'REINFORCED' : 'SINGLE'}</Text>
                </View>
              </View>
              <View style={styles.scheduleCol}>
                <Text style={[styles.colHeading, { color: theme.primary }]}>TYPOLOGY &amp; FINISH</Text>
                <View style={styles.scheduleRow}>
                  <Text style={[styles.scheduleKey, { color: theme.onSurfaceVariant }]}>Style:</Text>
                  <Text style={[styles.scheduleVal, { color: theme.onSurface }]}>{form.archStyle.toUpperCase()}</Text>
                </View>
                <View style={styles.scheduleRow}>
                  <Text style={[styles.scheduleKey, { color: theme.onSurfaceVariant }]}>Finish Grade:</Text>
                  <Text style={[styles.scheduleVal, { color: theme.onSurface }]}>{form.finish.toUpperCase()}</Text>
                </View>
              </View>
            </View>
          </View>

        </ScrollView>
      </View>
    );
  }

  // ─── Main Architectural Studio Workspace ──
  return (
    <View style={[styles.root, { backgroundColor: theme.surface }]}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: isSmallMobile ? 10 : isWide ? 24 : 14 },
          isWide && { maxWidth: 960, alignSelf: 'center', width: '100%' },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Navigation Bar */}
        <View style={styles.topNavRow}>
          <Pressable
            onPress={() => router.back()}
            style={[
              styles.roundBackBtn,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                borderColor: theme.outlineVariant,
              },
            ]}
          >
            <MaterialIcons name="arrow-back" size={18} color={theme.onSurface} />
          </Pressable>

          <View style={styles.statusChipGroup}>
            <View style={[styles.technicalStatusPill, { borderColor: 'rgba(218,165,32,0.3)', backgroundColor: 'rgba(218,165,32,0.08)' }]}>
              <View style={[styles.pulseBeacon, { backgroundColor: theme.primary }]} />
              <Text style={{ color: theme.primary, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.5 }}>ARCHITECTURAL STUDIO</Text>
            </View>


            {isWide && (
              <View style={[styles.technicalStatusPill, { borderColor: theme.outlineVariant, backgroundColor: isDark ? '#0C1626' : '#F1F5F9' }]}>
                <Text style={{ color: theme.onSurfaceVariant, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>NBC 2024 / CMDA</Text>
              </View>
            )}
          </View>
        </View>

        {/* Studio Drafting Header */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.studioHero}>
          <View style={styles.studioHeroBadgeRow}>
            <View style={[styles.studioTag, { borderColor: theme.primary }]}>
              <MaterialCommunityIcons name="drawing-box" size={13} color={theme.primary} />
              <Text style={[styles.studioTagText, { color: theme.primary }]}>SPATIAL PROGRAMMING SUITE</Text>
            </View>
          </View>

          <Text style={[styles.studioTitle, { color: theme.onSurface }]}>
            House Plan &amp; Floor Layout Designer
          </Text>

          <Text style={[styles.studioSubtitle, { color: theme.onSurfaceVariant }]}>
            Parametric residential programming. Define dimensions, room adjacencies, orientation bearings, and structural specifications.
          </Text>
        </Animated.View>

        {/* Main Drafting Canvas Card */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(300)}
          style={[
            styles.draftingCard,
            {
              backgroundColor: isDark ? '#0A1220' : '#FFFFFF',
              borderColor: isDark ? 'rgba(218,165,32,0.25)' : theme.outlineVariant,
              padding: isWide ? 20 : isSmallMobile ? 12 : 14,
            },
          ]}
        >
          {/* Stage Timeline Header */}
          <View style={styles.stageTimelineHeader}>
            <View style={styles.stageProgressRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 }}>
                <Text style={[styles.stageStepCounter, { color: theme.primary }]}>
                  {String(step + 1).padStart(2, '0')}/{String(totalSteps).padStart(2, '0')}
                </Text>
                <Text numberOfLines={1} style={[styles.stagePhaseLabel, { color: theme.onSurface, flex: 1 }]}>
                  {allSteps[step]?.label}
                </Text>
              </View>
              <Text style={[styles.stagePercentage, { color: theme.primary }]}>{progressPct}%</Text>
            </View>

            {/* Hairline Progress Track */}
            <View style={[styles.hairlineTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : theme.surfaceContainer }]}>
              <View style={[styles.hairlineFill, { width: `${progressPct}%`, backgroundColor: theme.primary }]} />
            </View>

            {/* Step Selector Horizontal Bar */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {allSteps.map((s, idx) => {
                  const done = idx < step;
                  const active = idx === step;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => idx <= step && setStep(idx)}
                      style={[
                        styles.phaseTab,
                        {
                          backgroundColor: active
                            ? 'rgba(218,165,32,0.14)'
                            : done
                            ? 'rgba(34,197,94,0.08)'
                            : isDark
                            ? 'rgba(255,255,255,0.02)'
                            : theme.surfaceContainerLowest,
                          borderColor: active
                            ? theme.primary
                            : done
                            ? '#22c55e'
                            : theme.outlineVariant,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={done ? 'check' : s.iconName as any}
                        size={12}
                        color={active ? theme.primary : done ? '#22c55e' : theme.onSurfaceVariant}
                      />
                      <Text
                        style={[
                          styles.phaseTabLabel,
                          {
                            color: active ? theme.primary : done ? '#22c55e' : theme.onSurfaceVariant,
                            fontWeight: active ? '700' : '500',
                          },
                        ]}
                      >
                        {String(idx + 1).padStart(2, '0')} {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          <HairlineDivider theme={theme} />

          {/* Active Step Content */}
          <View style={{ paddingVertical: 8 }}>
            {renderStep()}
          </View>

          <HairlineDivider theme={theme} />

          {/* Drafting Navigation Bar */}
          <View style={styles.draftingFooter}>
            <Pressable
              onPress={goPrev}
              disabled={step === 0}
              style={({ pressed }) => [
                styles.navBtnSecondary,
                {
                  borderColor: theme.outlineVariant,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : theme.surfaceContainerLowest,
                  opacity: step === 0 ? 0.3 : pressed ? 0.7 : 1,
                },
              ]}
            >
              <MaterialIcons name="arrow-back" size={16} color={theme.onSurface} />
              <Text style={[styles.navBtnSecondaryText, { color: theme.onSurface }]}>
                {isWide ? 'Previous Phase' : 'Back'}
              </Text>
            </Pressable>

            <View style={styles.footerCenterBadge}>
              <Text style={[styles.footerBadgeText, { color: theme.onSurfaceVariant }]}>
                {allSteps[step]?.badge.toUpperCase()}
              </Text>
            </View>

            <Pressable
              onPress={goNext}
              style={({ pressed }) => [styles.navBtnPrimary, { opacity: pressed ? 0.85 : 1 }]}
            >
              <LinearGradient colors={['#DAA520', '#B8860B']} style={styles.navBtnPrimaryGrad}>
                <Text style={styles.navBtnPrimaryText}>
                  {step === totalSteps - 1
                    ? (outputMode === '2d' ? 'Synthesize 2D Plan' : outputMode === '3d' ? 'Synthesize 3D Plan' : 'Synthesize House Plans')
                    : (isWide ? 'Proceed to Next Phase' : 'Next Phase')}
                </Text>
                <MaterialIcons name="arrow-forward" size={16} color="#0A0F23" />
              </LinearGradient>
            </Pressable>
          </View>
        </Animated.View>

        {/* Architectural Design Standards & Guidelines (Bottom Section) */}
        <Animated.View entering={FadeInDown.delay(200).duration(300)} style={styles.standardsSection}>
          <View style={styles.standardsHeader}>
            <MaterialCommunityIcons name="book-open-page-variant-outline" size={18} color={theme.primary} />
            <Text style={[styles.standardsHeading, { color: theme.onSurface }]}>
              BIM Spatial Planning &amp; Engineering Standards
            </Text>
          </View>

          <View style={styles.standardsGrid}>
            {[
              {
                code: 'NBC 2024 / PART 3',
                title: 'Setback & Open Space Ratios',
                desc: 'Computes mandatory peripheral fire-clearances, front road setbacks, and maximum permissible ground coverage (FSI).',
                icon: 'ruler-square-compass',
              },
              {
                code: 'CLIMATIC MANDALA',
                title: 'Bioclimatic Solar Optimization',
                desc: 'Aligns principal fenestrations along north-south axes to mitigate harsh western solar heat gain and promote stack ventilation.',
                icon: 'weather-sunny-alert',
              },
              {
                code: 'IS 456 / STRUCTURAL',
                title: 'Column Grid Alignment',
                desc: 'Maintains cohesive structural columns across multiple floors to eliminate eccentric beam loads and reduce slab deflection.',
                icon: 'pillar',
              },
              {
                code: 'IS 1172 / MEP SERVICES',
                title: 'Plumbing Core Vertical Stacking',
                desc: 'Consolidates bathrooms and wet service risers into unified vertical plumbing ducts, eliminating lateral under-slab piping.',
                icon: 'pipe-wrench',
              },
            ].map((std, i) => (
              <View
                key={i}
                style={[
                  styles.standardCard,
                  isWide && { width: '48.5%' },
                  {
                    backgroundColor: isDark ? '#0A1220' : '#FFFFFF',
                    borderColor: isDark ? 'rgba(255,255,255,0.06)' : theme.outlineVariant,
                  },
                ]}
              >
                <View style={styles.standardCardTop}>
                  <Text style={[styles.standardCode, { color: theme.primary }]}>{std.code}</Text>
                  <MaterialCommunityIcons name={std.icon as any} size={16} color={theme.primary} />
                </View>
                <Text style={[styles.standardTitle, { color: theme.onSurface }]}>{std.title}</Text>
                <Text style={[styles.standardDesc, { color: theme.onSurfaceVariant }]}>{std.desc}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
        

        {/* ─── Modal: Fullscreen Image Preview ─── */}
        <Modal
          visible={!!fullscreenImage}
          animationType="fade"
          transparent
          onRequestClose={() => setFullscreenImage(null)}
        >
          <View style={styles.fullscreenOverlay}>
            <Pressable onPress={() => setFullscreenImage(null)} style={styles.fullscreenCloseBtn}>
              <MaterialIcons name="close" size={24} color="#FFFFFF" />
            </Pressable>
            {fullscreenImage && (
              <Image
                source={{ uri: resolveImageUrl(fullscreenImage) || fullscreenImage }}
                style={styles.fullscreenImg}
                resizeMode="contain"
              />
            )}
          </View>
        </Modal>
      </ScrollView>
    </View>
  );
}

// ─── Stylesheet ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: {
    paddingBottom: 40,
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingBottom: 14,
  },
  roundBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusChipGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  technicalStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    gap: 5,
  },
  pulseBeacon: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  studioHero: {
    marginBottom: 16,
  },
  studioHeroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  studioTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  studioTagText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  studioTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  studioSubtitle: {
    fontSize: 12.5,
    lineHeight: 18,
    maxWidth: 680,
  },
  draftingCard: {
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 20,
  },
  stageTimelineHeader: {
    marginBottom: 4,
  },
  stageProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  stageStepCounter: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  stagePhaseLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  stagePercentage: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  hairlineTrack: {
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  hairlineFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  phaseTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  phaseTabLabel: {
    fontSize: 10.5,
    letterSpacing: 0.2,
  },
  hairline: {
    height: 1,
    marginVertical: 14,
    opacity: 0.25,
  },
  sectionHeaderWrap: {
    marginBottom: 14,
  },
  sectionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  phasePill: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(218,165,32,0.1)',
  },
  phaseText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  phaseCode: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  sectionIconRing: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sectionSub: {
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  fieldHelp: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  dimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dimInputBox: {
    flex: 1,
  },
  dimLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  dimInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '700',
    height: 44,
    textAlign: 'center',
  },
  dimSeparator: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 14,
  },
  dimSeparatorText: {
    fontSize: 16,
    fontWeight: '600',
  },
  metricStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 6,
  },
  metricStripText: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  chipCard: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 6,
    minHeight: 48,
  },
  chipLabel: {
    fontSize: 11.5,
    lineHeight: 15,
  },
  chipSub: {
    fontSize: 9.5,
    marginTop: 1,
  },
  chipCheckbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  compassGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'space-between',
  },
  compassCell: {
    width: '23.5%',
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 58,
  },
  bearingCode: {
    fontSize: 8.5,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', web: 'monospace' }),
    fontWeight: '700',
    marginBottom: 1,
  },
  bearingShort: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  bearingLabel: {
    fontSize: 9,
    textAlign: 'center',
    marginTop: 1,
  },
  roadWidthWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  technicalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    height: 44,
  },
  unitBadgeBox: {
    paddingHorizontal: 10,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  noticeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 8,
  },
  noticeText: {
    fontSize: 11,
    lineHeight: 15,
    flex: 1,
  },
  subCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 4,
  },
  subCardTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
  },
  stepperLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  stepperSub: {
    fontSize: 10.5,
    marginTop: 1,
    lineHeight: 14,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
    height: 36,
  },
  stepBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDisplay: {
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  stepValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  stepUnit: {
    fontSize: 8.5,
  },
  metricSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  metricLabel: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 42,
  },
  toggleLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  toggleSub: {
    fontSize: 11,
    marginTop: 1,
    lineHeight: 15,
  },
  switchTrack: {
    width: 38,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  segCtrl: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    padding: 2,
    gap: 2,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  segText: {
    fontSize: 11,
  },
  radioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
    gap: 10,
    minHeight: 48,
  },
  radioIconBox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 10.5,
    marginTop: 2,
    lineHeight: 14,
  },
  radioIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  locationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    marginBottom: 6,
    gap: 8,
    height: 42,
  },
  locationBadge: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  technicalInputInline: {
    flex: 1,
    fontSize: 12,
    height: 42,
  },
  technicalTextarea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  charCounter: {
    position: 'absolute',
    bottom: 8,
    right: 10,
    fontSize: 9,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', web: 'monospace' }),
  },
  blueprintReadyStamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  stampIconRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  stampSub: {
    fontSize: 11,
    lineHeight: 15,
  },
  draftingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  navBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 42,
  },
  navBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footerCenterBadge: {
    flex: 1,
    alignItems: 'center',
  },
  footerBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  navBtnPrimary: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  navBtnPrimaryGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 42,
  },
  navBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0A0F23',
    letterSpacing: 0.2,
  },
  standardsSection: {
    marginBottom: 24,
  },
  standardsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  standardsHeading: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  standardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  standardCard: {
    width: '100%',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  standardCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  standardCode: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  standardTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 3,
  },
  standardDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  // Submitted Title Block
  titleBlockContainer: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  titleBlockHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleBlockIdentity: {
    flex: 1,
  },
  firmSub: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  sheetTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  refBox: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignItems: 'flex-end',
  },
  refLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  refCode: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  specSchedule: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  scheduleCol: {
    flex: 1,
    minWidth: 220,
  },
  colHeading: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  scheduleKey: {
    fontSize: 11,
  },
  scheduleVal: {
    fontSize: 11,
    fontWeight: '700',
  },
  resultActionRow: {
    gap: 8,
    marginBottom: 14,
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 12,
    minHeight: 44,
  },
  actionBtnSecondaryText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  actionBtnPrimary: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  actionBtnPrimaryGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    minHeight: 44,
  },
  actionBtnPrimaryText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0A0F23',
  },
  technicalJsonToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
  },
  technicalJsonToggleText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '600',
  },
  jsonViewerBox: {
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    maxHeight: 260,
  },
  jsonMonospaceText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', web: 'monospace' }),
    fontSize: 10,
    color: '#4ade80',
    lineHeight: 15,
  },
  actionBtnDownload: {
    borderRadius: 8,
    overflow: 'hidden',
    flex: 1,
  },
  topBarDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  topBarDownloadText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  phaseDownloadBtn: {
    borderRadius: 6,
    overflow: 'hidden',
  },
  phaseDownloadBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  phaseDownloadBtnText: {
    color: '#0A0F23',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  phaseCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 6,
    borderWidth: 1,
  },
  phaseCopyBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  jsonViewerToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  jsonSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    borderWidth: 1,
  },
  jsonSmallBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: '#DAA520',
  },
  galleryContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  galleryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  galleryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  galleryBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  galleryMainTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  gallerySubTitle: {
    fontSize: 11,
    marginTop: 2,
  },
  tabSelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    padding: 3,
    gap: 2,
    alignSelf: 'flex-start',
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  plansGrid: {
    gap: 14,
    marginTop: 12,
  },
  planCard: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cadTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  planImage: {
    width: '100%',
    height: 320,
    backgroundColor: '#000000',
  },
  imagePlaceholder: {
    width: '100%',
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  placeholderText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  cardFootnote: {
    fontSize: 10.5,
    flex: 1,
  },
  planDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  planDownloadText: {
    fontSize: 11,
    fontWeight: '700',
  },
  designSummaryBox: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginTop: 14,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  summaryBody: {
    fontSize: 11.5,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalDialog: {
    width: '100%',
    maxWidth: 680,
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 11,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 16,
  },
  modalSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  apiKeyInput: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
  },
  promptTextarea: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    fontSize: 11,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', web: 'monospace' }),
    lineHeight: 16,
    maxHeight: 280,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 6,
    borderWidth: 1,
  },
  modalCancelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalSaveBtn: {
    borderRadius: 6,
    overflow: 'hidden',
  },
  modalSaveBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  modalSaveBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0A0F23',
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 9999,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  fullscreenImg: {
    width: '95%',
    height: '85%',
  },
  threeGenButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  threeGenBtn: {
    flex: 1,
    minWidth: 140,
    borderRadius: 8,
    overflow: 'hidden',
  },
  threeGenBtnPrimary: {
    flex: 1.2,
    minWidth: 160,
    borderRadius: 8,
    overflow: 'hidden',
  },
  threeGenBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 48,
  },
  threeGenBtnTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  threeGenBtnSub: {
    fontSize: 9.5,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },
  promptTabsRow: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    padding: 3,
    gap: 4,
    marginBottom: 4,
  },
  promptTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  promptTabBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
});