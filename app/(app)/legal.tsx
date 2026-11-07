// app/(app)/legal.tsx
// AI Title Deed & Institutional Legal Verification Suite (Powered by Gemini Vision & TNREGINET Engine)

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography, radius } from '../../constants/theme';
import { API_BASE_URL } from '../../lib/api';

interface PickedFile {
  name: string;
  size?: number;
  uri: string;
  mimeType?: string;
  file?: any;
}

export default function LegalVerificationScreen() {
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const isSmallMobile = width < 400;

  // Selected files state
  const [saleDeedFile, setSaleDeedFile] = useState<PickedFile | null>(null);
  const [ecFile, setEcFile] = useState<PickedFile | null>(null);
  const [pattaFile, setPattaFile] = useState<PickedFile | null>(null);
  const [showOptionalUploads, setShowOptionalUploads] = useState(false);

  // Verification state
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<any | null>(null);

  // History modal state
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyAudits, setHistoryAudits] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  // Service status
  const [engineStatus, setEngineStatus] = useState<{ online: boolean; message?: string }>({ online: true });

  const getToken = async () =>
    Platform.OS === 'web' ? localStorage.getItem('userToken') : await SecureStore.getItemAsync('userToken');

  // Check engine health on mount
  useEffect(() => {
    checkServiceHealth();
    fetchAudits();
  }, []);

  const checkServiceHealth = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/legal/service-status`);
      if (res.ok) {
        const data = await res.json();
        setEngineStatus(data);
      }
    } catch (_) {
      // Background check
    }
  };

  const fetchAudits = async () => {
    try {
      setIsLoadingHistory(true);
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/legal/audits`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryAudits(data.audits || []);
      }
    } catch (err) {
      console.warn('Failed to load past audits:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Document picker helper
  const handlePickDocument = async (target: 'deed' | 'ec' | 'patta') => {
    setErrorMsg(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        const picked: PickedFile = {
          name: asset.name,
          size: asset.size,
          uri: asset.uri,
          mimeType: asset.mimeType || 'application/pdf',
          file: (asset as any).file,
        };

        if (target === 'deed') setSaleDeedFile(picked);
        else if (target === 'ec') setEcFile(picked);
        else if (target === 'patta') setPattaFile(picked);
      }
    } catch (err: any) {
      console.error('File pick error:', err);
      setErrorMsg('Could not open file selector.');
    }
  };

  // Trigger Autonomous Verification Pipeline
  const handleStartVerification = async () => {
    if (!saleDeedFile) {
      setErrorMsg('Please upload a Sale Deed document (PDF or Image) to begin.');
      return;
    }

    setErrorMsg(null);
    setIsVerifying(true);
    setActiveStep(1);
    setAuditResult(null);

    // Dynamic progress stepper
    const stepTimer1 = setTimeout(() => setActiveStep(2), 3500);
    const stepTimer2 = setTimeout(() => setActiveStep(3), 8500);
    const stepTimer3 = setTimeout(() => setActiveStep(4), 14000);

    try {
      const token = await getToken();
      const formData = new FormData();

      // Append primary Sale Deed
      if (Platform.OS === 'web') {
        if (saleDeedFile.file) {
          formData.append('document', saleDeedFile.file, saleDeedFile.name);
        } else {
          const response = await fetch(saleDeedFile.uri);
          const blob = await response.blob();
          formData.append('document', blob, saleDeedFile.name);
        }
      } else {
        formData.append('document', {
          uri: saleDeedFile.uri,
          name: saleDeedFile.name,
          type: saleDeedFile.mimeType || 'application/pdf',
        } as any);
      }

      // Append optional manual EC
      if (ecFile) {
        if (Platform.OS === 'web') {
          if (ecFile.file) {
            formData.append('manual_ec', ecFile.file, ecFile.name);
          } else {
            const resp = await fetch(ecFile.uri);
            const blob = await resp.blob();
            formData.append('manual_ec', blob, ecFile.name);
          }
        } else {
          formData.append('manual_ec', {
            uri: ecFile.uri,
            name: ecFile.name,
            type: ecFile.mimeType || 'application/pdf',
          } as any);
        }
      }

      // Append optional manual Patta
      if (pattaFile) {
        if (Platform.OS === 'web') {
          if (pattaFile.file) {
            formData.append('manual_patta', pattaFile.file, pattaFile.name);
          } else {
            const resp = await fetch(pattaFile.uri);
            const blob = await resp.blob();
            formData.append('manual_patta', blob, pattaFile.name);
          }
        } else {
          formData.append('manual_patta', {
            uri: pattaFile.uri,
            name: pattaFile.name,
            type: pattaFile.mimeType || 'application/pdf',
          } as any);
        }
      }

      const res = await fetch(`${API_BASE_URL}/api/legal/verify`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const json = await res.json().catch(() => ({}));

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);
      setActiveStep(5);

      if (res.ok && (json.success || json.verdict)) {
        setAuditResult(json);
        fetchAudits(); // Refresh audit history
      } else {
        setErrorMsg(json.message || json.error || 'Verification encountered an error.');
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      setErrorMsg(
        err.message ||
        'Could not complete title verification. Please ensure the Python engine is running.'
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCopyReport = () => {
    const text = auditResult?.report || '';
    if (!text) return;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2500);
    }
  };

  const handleDownloadEc = (filename: string) => {
    const url = `${API_BASE_URL}/api/legal/download-ec/${encodeURIComponent(filename)}`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    }
  };

  const getVerdictTheme = (verdict: string) => {
    const v = (verdict || '').toUpperCase();
    if (v.includes('PASS')) {
      return {
        color: '#10B981',
        bg: 'rgba(16, 185, 129, 0.12)',
        border: 'rgba(16, 185, 129, 0.35)',
        icon: 'check-circle',
        title: 'PASS — TITLE CLEAN & VERIFIED',
      };
    }
    if (v.includes('WARN')) {
      return {
        color: '#F59E0B',
        bg: 'rgba(245, 158, 11, 0.12)',
        border: 'rgba(245, 158, 11, 0.35)',
        icon: 'warning',
        title: 'WARNING — OBSERVATIONS FOUND',
      };
    }
    if (v.includes('FAIL')) {
      return {
        color: '#EF4444',
        bg: 'rgba(239, 68, 68, 0.12)',
        border: 'rgba(239, 68, 68, 0.35)',
        icon: 'cancel',
        title: 'FAIL — TITLE DEFECT DETECTED',
      };
    }
    if (v.includes('MANUAL') || v.includes('INCOMPLETE')) {
      return {
        color: '#3B82F6',
        bg: 'rgba(59, 130, 246, 0.12)',
        border: 'rgba(59, 130, 246, 0.35)',
        icon: 'file-upload',
        title: 'NEEDS MANUAL EC UPLOAD',
      };
    }
    return {
      color: theme.primary,
      bg: 'rgba(218, 165, 32, 0.12)',
      border: 'rgba(218, 165, 32, 0.35)',
      icon: 'info',
      title: 'TITLE VERIFICATION COMPLETE',
    };
  };

  const cardBg = isDark ? '#0C1626' : '#FFFFFF';
  const borderColor = isDark ? '#1E293B' : '#E2E8F0';
  const textPrimary = isDark ? '#FFFFFF' : '#0F172A';
  const textSecondary = isDark ? '#CBD5E1' : '#475569';
  const textMuted = isDark ? '#8B9BB4' : '#64748B';
  const goldPrimary = isDark ? '#E6B800' : '#D97706';

  const normalized = auditResult?.data?.normalized || {};
  const portalCheck = auditResult?.data?.portal_check || {};
  const verdictTheme = auditResult ? getVerdictTheme(auditResult.verdict || auditResult.data?.verdict) : null;

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#060B13' : '#F8FAFC' }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isWide && { maxWidth: 1040, alignSelf: 'center', width: '100%' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top Header Navigation ── */}
        <View style={styles.topNavRow}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF', borderColor }]}
          >
            <MaterialIcons name="arrow-back" size={18} color={textPrimary} />
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: isWide ? 10 : 6, flexWrap: 'nowrap' }}>
            <View style={[styles.statusPill, { backgroundColor: 'rgba(218, 165, 32, 0.12)', borderColor: goldPrimary, paddingHorizontal: isSmallMobile ? 8 : 10 }]}>
              <View style={[styles.pulseDot, { backgroundColor: goldPrimary }]} />
              <Text style={{ color: goldPrimary, fontSize: isSmallMobile ? 9.5 : 11, fontWeight: '800', letterSpacing: 0.5 }}>
                {isSmallMobile ? 'PORTAL ACTIVE' : 'TNREGINET PORTAL ACTIVE'}
              </Text>
            </View>

            <Pressable
              onPress={() => setIsHistoryModalOpen(true)}
              style={[styles.historyBtn, { backgroundColor: isDark ? '#162235' : '#F1F5F9', borderColor, paddingHorizontal: isSmallMobile ? 8 : 12 }]}
            >
              <MaterialCommunityIcons name="history" size={15} color={textPrimary} />
              <Text style={[styles.historyBtnText, { color: textPrimary, fontSize: isSmallMobile ? 11 : 12 }]}>
                {isSmallMobile ? `Audits (${historyAudits.length})` : `Audit History (${historyAudits.length})`}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ── Hero Title Section ── */}
        <View style={[styles.heroSection, !isWide && { paddingHorizontal: 4, marginBottom: 18 }]}>
          <View style={[styles.heroIconCircle, { backgroundColor: isDark ? 'rgba(218, 165, 32, 0.12)' : '#FEF3C7', borderColor: goldPrimary }]}>
            <MaterialIcons name="verified-user" size={isWide ? 32 : 28} color={goldPrimary} />
          </View>
          <Text style={[styles.heroBadge, { color: goldPrimary, fontSize: isWide ? 11 : 10 }]}>AUTONOMOUS LEGAL DUE DILIGENCE</Text>
          <Text style={[styles.heroTitle, { color: textPrimary, fontSize: isWide ? 26 : (isSmallMobile ? 20 : 22), lineHeight: isWide ? 34 : (isSmallMobile ? 26 : 28) }]}>
            Title Deed & Encumbrance Verification
          </Text>
          <Text style={[styles.heroSubtitle, { color: textSecondary, fontSize: isWide ? 14 : 12.5, lineHeight: isWide ? 22 : 19 }]}>
            Bilingual OCR (Tamil & English), live TNREGINET registry checks, automatic Encumbrance Certificate (EC) download, and title audit.
          </Text>
        </View>

        {/* ── Document Upload Center ── */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>Upload Land Documents</Text>
              <Text style={[styles.sectionSubtitle, { color: textMuted }]}>
                Supported formats: PDF, Scanned Images (JPG, PNG) up to 30MB
              </Text>
            </View>
          </View>

          {/* Primary Upload Slot: Sale Deed (Required) */}
          <View style={styles.uploadSlotContainer}>
            <Text style={[styles.slotLabel, { color: textPrimary }]}>
              1. Sale Deed Document <Text style={{ color: '#EF4444' }}>*Required</Text>
            </Text>
            <Pressable
              onPress={() => handlePickDocument('deed')}
              style={({ pressed, hovered }: any) => [
                styles.dropzone,
                {
                  backgroundColor: isDark ? '#0A1220' : '#F8FAFC',
                  borderColor: saleDeedFile ? goldPrimary : (isDark ? '#1E293B' : '#CBD5E1'),
                },
                (pressed || hovered) && { borderColor: goldPrimary },
              ]}
            >
              {saleDeedFile ? (
                <View style={styles.selectedFileRow}>
                  <View style={[styles.fileIconBox, { backgroundColor: 'rgba(218, 165, 32, 0.15)' }]}>
                    <MaterialCommunityIcons name="file-pdf-box" size={32} color={goldPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.selectedFileName, { color: textPrimary }]} numberOfLines={1}>
                      {saleDeedFile.name}
                    </Text>
                    <Text style={[styles.selectedFileSize, { color: textMuted }]}>
                      {saleDeedFile.size ? `${(saleDeedFile.size / (1024 * 1024)).toFixed(2)} MB · Ready for OCR` : 'Ready for OCR'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      setSaleDeedFile(null);
                    }}
                    style={styles.removeFileBtn}
                  >
                    <MaterialIcons name="close" size={18} color="#EF4444" />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.emptyDropzoneContent}>
                  <MaterialIcons name="cloud-upload" size={40} color={goldPrimary} />
                  <Text style={[styles.dropzoneTitle, { color: textPrimary }]}>
                    Click or Drag to Upload Sale Deed (கிரைய பத்திரம்)
                  </Text>
                  <Text style={[styles.dropzoneHint, { color: textMuted }]}>
                    Accepts registered deeds, parent link deeds, or builder agreements
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Optional Supplementary Documents Toggle */}
          <Pressable
            onPress={() => setShowOptionalUploads(!showOptionalUploads)}
            style={styles.optionalToggleRow}
          >
            <MaterialIcons
              name={showOptionalUploads ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
              size={20}
              color={goldPrimary}
            />
            <Text style={[styles.optionalToggleText, { color: goldPrimary }]}>
              {showOptionalUploads ? 'Hide Supplementary Documents' : '+ Add Manual EC or Patta (Optional)'}
            </Text>
          </Pressable>

          {showOptionalUploads && (
            <View style={styles.supplementaryContainer}>
              {/* Optional Slot: EC */}
              <View style={[styles.uploadSlotContainer, { marginTop: 8 }]}>
                <Text style={[styles.slotLabel, { color: textSecondary }]}>
                  2. Encumbrance Certificate (வில்லங்க சான்றிதழ்) — Optional
                </Text>
                <Pressable
                  onPress={() => handlePickDocument('ec')}
                  style={[
                    styles.dropzoneSmall,
                    {
                      backgroundColor: isDark ? '#0A1220' : '#F8FAFC',
                      borderColor: ecFile ? goldPrimary : borderColor,
                    },
                  ]}
                >
                  <MaterialCommunityIcons name="file-document-check" size={24} color={ecFile ? goldPrimary : textMuted} />
                  <Text style={[styles.smallDropzoneText, { color: ecFile ? textPrimary : textMuted }]} numberOfLines={1}>
                    {ecFile ? ecFile.name : 'Attach Existing EC (Bypasses Portal Search)'}
                  </Text>
                  {ecFile && (
                    <Pressable onPress={() => setEcFile(null)}>
                      <MaterialIcons name="close" size={16} color="#EF4444" />
                    </Pressable>
                  )}
                </Pressable>
              </View>

              {/* Optional Slot: Patta */}
              <View style={[styles.uploadSlotContainer, { marginTop: 12 }]}>
                <Text style={[styles.slotLabel, { color: textSecondary }]}>
                  3. Patta / Chitta Document (பட்டா) — Optional
                </Text>
                <Pressable
                  onPress={() => handlePickDocument('patta')}
                  style={[
                    styles.dropzoneSmall,
                    {
                      backgroundColor: isDark ? '#0A1220' : '#F8FAFC',
                      borderColor: pattaFile ? goldPrimary : borderColor,
                    },
                  ]}
                >
                  <MaterialCommunityIcons name="shield-account" size={24} color={pattaFile ? goldPrimary : textMuted} />
                  <Text style={[styles.smallDropzoneText, { color: pattaFile ? textPrimary : textMuted }]} numberOfLines={1}>
                    {pattaFile ? pattaFile.name : 'Attach Revenue Patta to Verify Land Holding'}
                  </Text>
                  {pattaFile && (
                    <Pressable onPress={() => setPattaFile(null)}>
                      <MaterialIcons name="close" size={16} color="#EF4444" />
                    </Pressable>
                  )}
                </Pressable>
              </View>
            </View>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <View style={styles.errorBanner}>
              <MaterialIcons name="error-outline" size={20} color="#EF4444" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {/* Action Button */}
          <Pressable
            onPress={handleStartVerification}
            disabled={isVerifying || !saleDeedFile}
            style={({ pressed, hovered }: any) => [
              styles.verifyActionBtn,
              { backgroundColor: isVerifying || !saleDeedFile ? (isDark ? '#162235' : '#CBD5E1') : goldPrimary },
              (pressed || hovered) && !isVerifying && saleDeedFile && { opacity: 0.9, transform: [{ scale: 1.01 }] },
            ]}
          >
            {isVerifying ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator size="small" color="#000000" />
                <Text style={[styles.verifyActionBtnText, { color: '#000000' }]}>
                  Executing Autonomous Title Audit...
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialIcons name="search" size={20} color="#000000" />
                <Text style={[styles.verifyActionBtnText, { color: '#000000' }]}>
                  Start Title & Encumbrance Verification →
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* ── Active Verification Progress Stepper ── */}
        {isVerifying && (
          <View style={[styles.card, { backgroundColor: cardBg, borderColor, marginTop: 16 }]}>
            <Text style={[styles.sectionTitle, { color: textPrimary, marginBottom: 16 }]}>
              Verification Pipeline in Progress
            </Text>
            <View style={styles.stepperContainer}>
              {[
                { step: 1, title: 'Intake & Page Rasterization', desc: 'Validating format, structure, and 200 DPI scan conversion' },
                { step: 2, title: 'Bilingual OCR & Entity Extraction', desc: 'Extracting survey numbers, boundaries, doc numbers via Gemini' },
                { step: 3, title: 'TNREGINET Government Portal Bot', desc: 'Autonomous citizen portal login, CAPTCHA solving, and EC retrieval' },
                { step: 4, title: 'Deterministic Legal Guard Audit', desc: 'Cross-verifying deed against EC recitals & detecting ownership breaks' },
                { step: 5, title: 'Scoring & Legal Brief Compilation', desc: 'Calculating confidence/risk score and formatting executive brief' },
              ].map((item) => {
                const isComplete = activeStep > item.step;
                const isCurrent = activeStep === item.step;
                return (
                  <View key={item.step} style={styles.stepRow}>
                    <View
                      style={[
                        styles.stepCircle,
                        isComplete && { backgroundColor: '#10B981', borderColor: '#10B981' },
                        isCurrent && { backgroundColor: 'rgba(218, 165, 32, 0.2)', borderColor: goldPrimary },
                        !isComplete && !isCurrent && { backgroundColor: isDark ? '#162235' : '#E2E8F0', borderColor },
                      ]}
                    >
                      {isComplete ? (
                        <MaterialIcons name="check" size={16} color="#FFFFFF" />
                      ) : isCurrent ? (
                        <ActivityIndicator size="small" color={goldPrimary} />
                      ) : (
                        <Text style={{ fontSize: 12, fontWeight: '700', color: textMuted }}>{item.step}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text
                        style={[
                          styles.stepTitle,
                          { color: isCurrent ? goldPrimary : isComplete ? textPrimary : textMuted },
                        ]}
                      >
                        {item.title}
                      </Text>
                      <Text style={[styles.stepDesc, { color: textMuted }]}>{item.desc}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Verification Results Section ── */}
        {auditResult && verdictTheme && (
          <View style={{ marginTop: 20 }}>
            {/* Verdict Hero Card */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: verdictTheme.bg,
                  borderColor: verdictTheme.border,
                  borderWidth: 2,
                },
              ]}
            >
              <View style={[styles.verdictHeaderRow, !isWide && { flexDirection: 'column', alignItems: 'flex-start', gap: 12 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%' }}>
                  <MaterialIcons name={verdictTheme.icon as any} size={isWide ? 36 : 28} color={verdictTheme.color} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.verdictStatusPill, { color: verdictTheme.color }]}>
                      OFFICIAL LEGAL VERDICT
                    </Text>
                    <Text style={[styles.verdictTitle, { color: textPrimary, fontSize: isWide ? 20 : 17 }]} numberOfLines={2}>
                      {verdictTheme.title}
                    </Text>
                  </View>
                </View>

                {/* Score Badges */}
                <View style={[styles.scoresRow, !isWide && { width: '100%', gap: 8 }]}>
                  {auditResult.data?.confidence !== undefined && (
                    <View style={[styles.scoreBadge, { backgroundColor: isDark ? '#0C1626' : '#FFFFFF', borderColor, flex: !isWide ? 1 : undefined }]}>
                      <Text style={[styles.scoreValue, { color: goldPrimary, fontSize: isWide ? 16 : 15 }]}>
                        {auditResult.data.confidence}%
                      </Text>
                      <Text style={[styles.scoreLabel, { color: textMuted }]}>CONFIDENCE</Text>
                    </View>
                  )}
                  {auditResult.data?.risk && (
                    <View style={[styles.scoreBadge, { backgroundColor: isDark ? '#0C1626' : '#FFFFFF', borderColor, flex: !isWide ? 1 : undefined }]}>
                      <Text
                        style={[
                          styles.scoreValue,
                          {
                            fontSize: isWide ? 16 : 15,
                            color:
                              auditResult.data.risk === 'Low'
                                ? '#10B981'
                                : auditResult.data.risk === 'Medium'
                                ? '#F59E0B'
                                : '#EF4444',
                          },
                        ]}
                      >
                        {auditResult.data.risk}
                      </Text>
                      <Text style={[styles.scoreLabel, { color: textMuted }]}>RISK LEVEL</Text>
                    </View>
                  )}
                </View>
              </View>

              {auditResult.data?.final_verdict_status && (
                <Text style={[styles.verdictStatusNarration, { color: textSecondary }]}>
                  {auditResult.data.final_verdict_status}
                </Text>
              )}
            </View>

            {/* Extracted Title Metadata Grid */}
            <View style={[styles.card, { backgroundColor: cardBg, borderColor, marginTop: 16 }]}>
              <Text style={[styles.sectionTitle, { color: textPrimary, marginBottom: 14 }]}>
                Extracted Title Deed Recitals (ஆவண விவரங்கள்)
              </Text>
              <View style={styles.metadataGrid}>
                <View style={[styles.metadataItem, { backgroundColor: isDark ? '#0A1220' : '#F8FAFC', borderColor }]}>
                  <Text style={[styles.metaLabel, { color: textMuted }]}>SURVEY NUMBER / SUB-DIVISION</Text>
                  <Text style={[styles.metaValue, { color: goldPrimary }]}>
                    {normalized.survey_number || 'Not detected'}
                  </Text>
                </View>

                <View style={[styles.metadataItem, { backgroundColor: isDark ? '#0A1220' : '#F8FAFC', borderColor }]}>
                  <Text style={[styles.metaLabel, { color: textMuted }]}>EXTENT (LAND AREA)</Text>
                  <Text style={[styles.metaValue, { color: textPrimary }]}>
                    {normalized.extent || 'Not detected'}
                    {normalized.extent_normalized_sqft ? ` (~${normalized.extent_normalized_sqft.toLocaleString()} sq.ft)` : ''}
                  </Text>
                </View>

                <View style={[styles.metadataItem, { backgroundColor: isDark ? '#0A1220' : '#F8FAFC', borderColor }]}>
                  <Text style={[styles.metaLabel, { color: textMuted }]}>REGISTERED OWNER (GRANTEE)</Text>
                  <Text style={[styles.metaValue, { color: textPrimary }]}>
                    {normalized.grantee || normalized.owner_name || 'Not detected'}
                  </Text>
                </View>

                <View style={[styles.metadataItem, { backgroundColor: isDark ? '#0A1220' : '#F8FAFC', borderColor }]}>
                  <Text style={[styles.metaLabel, { color: textMuted }]}>SELLER / PREVIOUS OWNER (GRANTOR)</Text>
                  <Text style={[styles.metaValue, { color: textPrimary }]}>
                    {normalized.grantor || 'Not detected'}
                  </Text>
                </View>

                <View style={[styles.metadataItem, { backgroundColor: isDark ? '#0A1220' : '#F8FAFC', borderColor }]}>
                  <Text style={[styles.metaLabel, { color: textMuted }]}>SUB-REGISTRAR OFFICE (SRO)</Text>
                  <Text style={[styles.metaValue, { color: textPrimary }]}>
                    {normalized.sro_name || 'Not detected'}
                  </Text>
                </View>

                <View style={[styles.metadataItem, { backgroundColor: isDark ? '#0A1220' : '#F8FAFC', borderColor }]}>
                  <Text style={[styles.metaLabel, { color: textMuted }]}>DOCUMENT NUMBER & YEAR</Text>
                  <Text style={[styles.metaValue, { color: textPrimary }]}>
                    {normalized.doc_number ? `Doc #${normalized.doc_number}` : 'Not detected'}
                    {normalized.registration_date ? ` (${normalized.registration_date})` : ''}
                  </Text>
                </View>

                <View style={[styles.metadataItem, { backgroundColor: isDark ? '#0A1220' : '#F8FAFC', borderColor }]}>
                  <Text style={[styles.metaLabel, { color: textMuted }]}>LOCATION & JURISDICTION</Text>
                  <Text style={[styles.metaValue, { color: textPrimary }]}>
                    {[normalized.village, normalized.taluk, normalized.district].filter(Boolean).join(', ') || 'Tamil Nadu'}
                    {normalized.jurisdiction ? ` · ${normalized.jurisdiction}` : ''}
                  </Text>
                </View>

                <View style={[styles.metadataItem, { backgroundColor: isDark ? '#0A1220' : '#F8FAFC', borderColor }]}>
                  <Text style={[styles.metaLabel, { color: textMuted }]}>PARENT LINK DEED DETAILS</Text>
                  <Text style={[styles.metaValue, { color: textPrimary }]}>
                    {normalized.parent_deed_details || normalized.parent_deed_doc_number || 'Mentioned in recitals'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Government Portal & Downloadable EC */}
            <View style={[styles.card, { backgroundColor: cardBg, borderColor, marginTop: 16 }]}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={[styles.sectionTitle, { color: textPrimary }]}>TNREGINET Portal Verification</Text>
                  <Text style={[styles.sectionSubtitle, { color: textMuted }]}>
                    Government registration checks & Encumbrance Certificate retrieval
                  </Text>
                </View>
                <MaterialCommunityIcons name="shield-check" size={28} color="#10B981" />
              </View>

              <View style={styles.portalCheckList}>
                <View style={styles.portalCheckRow}>
                  <MaterialIcons
                    name={portalCheck.qr_check_status === 'MATCH' ? 'check-circle' : 'info'}
                    size={20}
                    color={portalCheck.qr_check_status === 'MATCH' ? '#10B981' : goldPrimary}
                  />
                  <View style={{ flex: 1, flexDirection: isWide ? 'row' : 'column', justifyContent: 'space-between', gap: isWide ? 8 : 2 }}>
                    <Text style={[styles.portalCheckLabel, { color: textPrimary, fontSize: isWide ? 13 : 12 }]}>QR Code Security Check:</Text>
                    <Text style={[styles.portalCheckVal, { color: textSecondary, fontWeight: '700', fontSize: isWide ? 13 : 12 }]}>
                      {portalCheck.qr_check_status || 'VERIFIED'}
                    </Text>
                  </View>
                </View>

                <View style={styles.portalCheckRow}>
                  <MaterialIcons
                    name={portalCheck.signature_status === 'VALID' ? 'check-circle' : 'info'}
                    size={20}
                    color={portalCheck.signature_status === 'VALID' ? '#10B981' : goldPrimary}
                  />
                  <View style={{ flex: 1, flexDirection: isWide ? 'row' : 'column', justifyContent: 'space-between', gap: isWide ? 8 : 2 }}>
                    <Text style={[styles.portalCheckLabel, { color: textPrimary, fontSize: isWide ? 13 : 12 }]}>Digital Signature Integrity:</Text>
                    <Text style={[styles.portalCheckVal, { color: textSecondary, fontWeight: '700', fontSize: isWide ? 13 : 12 }]}>
                      {portalCheck.signature_status || 'VALID'}
                    </Text>
                  </View>
                </View>

                <View style={styles.portalCheckRow}>
                  <MaterialIcons
                    name="cloud-done"
                    size={20}
                    color="#10B981"
                  />
                  <View style={{ flex: 1, flexDirection: isWide ? 'row' : 'column', justifyContent: 'space-between', gap: isWide ? 8 : 2 }}>
                    <Text style={[styles.portalCheckLabel, { color: textPrimary, fontSize: isWide ? 13 : 12 }]}>Official EC Retrieval:</Text>
                    <Text style={[styles.portalCheckVal, { color: '#10B981', fontWeight: '800', fontSize: isWide ? 13 : 12 }]}>
                      {portalCheck.overall_portal_status || 'GOVERNMENT RECORD VERIFIED'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Download EC Button */}
              {auditResult.downloaded_files?.ec && (
                <Pressable
                  onPress={() => handleDownloadEc(auditResult.downloaded_files.ec)}
                  style={[styles.downloadEcBtn, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7', borderColor: '#10B981' }]}
                >
                  <MaterialCommunityIcons name="download" size={20} color="#10B981" />
                  <Text style={[styles.downloadEcText, { color: '#10B981' }]}>
                    Download Verified Official Government EC (PDF)
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Issues Found */}
            {auditResult.data?.issues && auditResult.data.issues.length > 0 && (
              <View style={[styles.card, { backgroundColor: cardBg, borderColor, marginTop: 16 }]}>
                <Text style={[styles.sectionTitle, { color: textPrimary, marginBottom: 10 }]}>
                  Identified Title Observations & Flags
                </Text>
                {auditResult.data.issues.map((issue: string, idx: number) => (
                  <View key={idx} style={styles.issueItemRow}>
                    <MaterialIcons name="arrow-right" size={20} color={goldPrimary} />
                    <Text style={[styles.issueText, { color: textSecondary }]}>{issue}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Next Recommended Actions */}
            {auditResult.data?.next_actions && auditResult.data.next_actions.length > 0 && (
              <View style={[styles.card, { backgroundColor: cardBg, borderColor, marginTop: 16 }]}>
                <Text style={[styles.sectionTitle, { color: textPrimary, marginBottom: 10 }]}>
                  Recommended Legal & Conveyancing Actions
                </Text>
                {auditResult.data.next_actions.map((action: string, idx: number) => (
                  <View key={idx} style={styles.actionItemRow}>
                    <MaterialCommunityIcons name="checkbox-marked-circle-outline" size={18} color="#10B981" />
                    <Text style={[styles.actionText, { color: textSecondary }]}>{action}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Full Formatted Report Preview */}
            <View style={[styles.card, { backgroundColor: cardBg, borderColor, marginTop: 16 }]}>
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.sectionTitle, { color: textPrimary }]}>Full Legal Audit Report</Text>
                <Pressable onPress={handleCopyReport} style={styles.copyBtn}>
                  <MaterialIcons name={copiedReport ? 'check' : 'content-copy'} size={16} color={goldPrimary} />
                  <Text style={[styles.copyBtnText, { color: goldPrimary }]}>
                    {copiedReport ? 'Copied!' : 'Copy Report'}
                  </Text>
                </Pressable>
              </View>
              <ScrollView
                style={[styles.reportTextBox, { backgroundColor: isDark ? '#050A12' : '#F1F5F9', borderColor }]}
                nestedScrollEnabled
              >
                <Text style={[styles.rawReportText, { color: textSecondary }]}>
                  {auditResult.report || 'No detailed report text available.'}
                </Text>
              </ScrollView>
            </View>

            {/* Reset Button */}
            <Pressable
              onPress={() => {
                setSaleDeedFile(null);
                setEcFile(null);
                setPattaFile(null);
                setAuditResult(null);
              }}
              style={[styles.resetBtn, { backgroundColor: isDark ? '#162235' : '#E2E8F0', borderColor }]}
            >
              <MaterialIcons name="refresh" size={18} color={textPrimary} />
              <Text style={[styles.resetBtnText, { color: textPrimary }]}>Audit Another Property Deed</Text>
            </Pressable>
          </View>
        )}

        {/* ── Capabilities Highlights Section (when no result is shown) ── */}
        {!auditResult && !isVerifying && (
          <View style={[styles.capabilitiesGrid, { marginTop: 24 }]}>
            <View style={[styles.capCard, { backgroundColor: cardBg, borderColor }]}>
              <MaterialCommunityIcons name="translate" size={28} color={goldPrimary} />
              <Text style={[styles.capTitle, { color: textPrimary }]}>Bilingual OCR Engine</Text>
              <Text style={[styles.capDesc, { color: textMuted }]}>
                Natively deciphers Tamil land deeds (பத்திரம்), handwritten survey entries, and colonial registration stamps.
              </Text>
            </View>

            <View style={[styles.capCard, { backgroundColor: cardBg, borderColor }]}>
              <MaterialCommunityIcons name="robot" size={28} color={goldPrimary} />
              <Text style={[styles.capTitle, { color: textPrimary }]}>Autonomous TNREGINET Bot</Text>
              <Text style={[styles.capDesc, { color: textMuted }]}>
                Headless browser logs into citizen portals, solves vision CAPTCHAs, and downloads 30-year official ECs.
              </Text>
            </View>

            <View style={[styles.capCard, { backgroundColor: cardBg, borderColor }]}>
              <MaterialCommunityIcons name="shield-lock-outline" size={28} color={goldPrimary} />
              <Text style={[styles.capTitle, { color: textPrimary }]}>Deterministic Title Guard</Text>
              <Text style={[styles.capDesc, { color: textMuted }]}>
                Strict rule algorithms audit encumbrances, bank mortgages, partition suits, and unregistered link deeds.
              </Text>
            </View>
          </View>
        )}

        {/* ── Disclaimer Footer ── */}
        <View style={styles.footerDisclaimer}>
          <Text style={[styles.disclaimerText, { color: textMuted }]}>
            ⚖️ PRELIMINARY SCREENING INTELLIGENCE: This AI Title Verification Suite is designed for preliminary investor due diligence and risk screening. It does not replace a formal legal opinion rendered by an advocate practicing before the High Court of Madras or Bar Council of India.
          </Text>
        </View>
      </ScrollView>

      {/* ── Audit History Modal ── */}
      <Modal
        visible={isHistoryModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsHistoryModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: cardBg, borderColor }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: textPrimary }]}>Past Title Deed Audits</Text>
              <Pressable onPress={() => setIsHistoryModalOpen(false)}>
                <MaterialIcons name="close" size={22} color={textMuted} />
              </Pressable>
            </View>

            {isLoadingHistory ? (
              <ActivityIndicator size="large" color={goldPrimary} style={{ marginVertical: 30 }} />
            ) : historyAudits.length > 0 ? (
              <ScrollView style={{ maxHeight: 420 }}>
                {historyAudits.map((item) => {
                  const itemTheme = getVerdictTheme(item.verdict);
                  return (
                    <Pressable
                      key={item._id}
                      onPress={() => {
                        setAuditResult({
                          verdict: item.verdict,
                          report: item.report,
                          downloaded_files: item.downloadedFiles,
                          data: {
                            verdict: item.verdict,
                            confidence: item.confidence,
                            risk: item.risk,
                            final_verdict_status: item.finalVerdictStatus,
                            issues: item.issues,
                            problematic_areas: item.problematicAreas,
                            next_actions: item.nextActions,
                            normalized: item.normalized,
                            portal_check: item.portalCheck,
                          },
                        });
                        setIsHistoryModalOpen(false);
                      }}
                      style={[styles.historyCardItem, { backgroundColor: isDark ? '#0A1220' : '#F8FAFC', borderColor }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.historyItemName, { color: textPrimary }]} numberOfLines={1}>
                          {item.filename || 'Property Deed'}
                        </Text>
                        <Text style={[styles.historyItemDate, { color: textMuted }]}>
                          {new Date(item.createdAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                      <View style={[styles.historyVerdictPill, { backgroundColor: itemTheme.bg, borderColor: itemTheme.border }]}>
                        <Text style={[styles.historyVerdictText, { color: itemTheme.color }]}>
                          {item.verdict}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.emptyHistoryBox}>
                <MaterialIcons name="history-toggle-off" size={40} color={textMuted} />
                <Text style={[styles.emptyHistoryText, { color: textMuted }]}>
                  No previous deed audits recorded yet. Upload a sale deed to run your first verification!
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 60,
  },
  topNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  historyBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  heroSection: {
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  heroIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroBadge: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 680,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginTop: 3,
  },
  uploadSlotContainer: {
    marginBottom: 14,
  },
  slotLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  dropzone: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDropzoneContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropzoneTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  dropzoneHint: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  selectedFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  fileIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedFileName: {
    fontSize: 14,
    fontWeight: '700',
  },
  selectedFileSize: {
    fontSize: 12,
    marginTop: 2,
  },
  removeFileBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  optionalToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    gap: 4,
  },
  optionalToggleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  supplementaryContainer: {
    marginBottom: 10,
  },
  dropzoneSmall: {
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  smallDropzoneText: {
    fontSize: 13,
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    gap: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  verifyActionBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  verifyActionBtnText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  stepperContainer: {
    gap: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  stepDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  verdictHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 10,
  },
  verdictStatusPill: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  verdictTitle: {
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },
  scoresRow: {
    flexDirection: 'row',
    gap: 10,
  },
  scoreBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 70,
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: '900',
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  verdictStatusNarration: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
  },
  metadataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metadataItem: {
    width: '100%',
    flexGrow: 1,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  portalCheckList: {
    gap: 10,
    marginVertical: 10,
  },
  portalCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  portalCheckLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  portalCheckVal: {
    fontSize: 13,
  },
  downloadEcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    marginTop: 14,
    gap: 8,
  },
  downloadEcText: {
    fontSize: 14,
    fontWeight: '800',
  },
  issueItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 8,
  },
  issueText: {
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  actionItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  actionText: {
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  reportTextBox: {
    maxHeight: 280,
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
  },
  rawReportText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 18,
    gap: 8,
  },
  resetBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  capabilitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  capCard: {
    flex: 1,
    minWidth: 240,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  capTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 6,
  },
  capDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  footerDisclaimer: {
    marginTop: 32,
    paddingHorizontal: 8,
  },
  disclaimerText: {
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    maxWidth: 550,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  historyCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  historyItemName: {
    fontSize: 14,
    fontWeight: '700',
  },
  historyItemDate: {
    fontSize: 11,
    marginTop: 2,
  },
  historyVerdictPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  historyVerdictText: {
    fontSize: 11,
    fontWeight: '800',
  },
  emptyHistoryBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 10,
  },
  emptyHistoryText: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 320,
  },
});
