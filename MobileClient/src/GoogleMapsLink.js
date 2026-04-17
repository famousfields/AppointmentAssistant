import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from './theme'

const buildGoogleMapsUrl = (address) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(address || '').trim())}`

export default function GoogleMapsLink({ address }) {
  const trimmedAddress = String(address || '').trim()

  if (!trimmedAddress) return null

  const handlePress = async () => {
    try {
      await Linking.openURL(buildGoogleMapsUrl(trimmedAddress))
    } catch (error) {
      console.error('Failed to open Google Maps:', error)
      Alert.alert('Unable to open Google Maps', 'Please try again.')
    }
  }

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open ${trimmedAddress} in Google Maps`}
      onPress={handlePress}
      style={({ pressed }) => [styles.linkButton, pressed ? styles.linkButtonPressed : null]}
    >
      <View style={styles.icon}>
        <View style={[styles.iconPanel, styles.iconPanelLeft]} />
        <View style={[styles.iconPanel, styles.iconPanelMiddle]} />
        <View style={[styles.iconPanel, styles.iconPanelRight]} />
      </View>
      <Text style={styles.label}>Open in Google Maps</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  linkButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: 'rgba(109, 124, 255, 0.12)',
    borderWidth: 1,
    borderColor: colors.borderStrong
  },
  linkButtonPressed: {
    opacity: 0.85
  },
  icon: {
    flexDirection: 'row',
    width: 16,
    height: 12,
    marginRight: 6,
    borderWidth: 1,
    borderColor: colors.heading,
    borderRadius: 2,
    overflow: 'hidden'
  },
  iconPanel: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRightWidth: 1,
    borderRightColor: colors.heading
  },
  iconPanelLeft: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)'
  },
  iconPanelMiddle: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)'
  },
  iconPanelRight: {
    borderRightWidth: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.08)'
  },
  label: {
    color: colors.heading,
    fontSize: 13,
    fontWeight: '700'
  }
})
