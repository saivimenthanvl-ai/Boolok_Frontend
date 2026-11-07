import React from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { getReelCoverUrl, getReelVideoUrl } from '../lib/reelMedia';

const NATIVE_FALLBACK_COVER = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600';

export default function ReelThumbnail({ reel }: { reel: any }) {
  const cover = getReelCoverUrl(reel);
  if (cover) {
    return <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} resizeMode="cover" />;
  }

  const videoUrl = getReelVideoUrl(reel);
  if (Platform.OS === 'web' && videoUrl) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000' }]} pointerEvents="none">
        <video
          src={videoUrl.startsWith('blob:') || videoUrl.startsWith('data:') ? videoUrl : `${videoUrl}#t=0.5`}
          muted
          playsInline
          preload="metadata"
          style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
        />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: reel?.thumbnail || reel?.poster || NATIVE_FALLBACK_COVER }}
      style={StyleSheet.absoluteFill}
      resizeMode="cover"
    />
  );
}
