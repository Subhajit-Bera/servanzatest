import React from 'react';
import { View, StyleSheet, StyleProp, ImageStyle } from 'react-native';
import { Image, ImageProps } from 'expo-image';
import { COLORS } from '../config/theme';

export interface ServiceImageProps extends Omit<ImageProps, 'source'> {
    url: string | null | undefined;
    style?: StyleProp<ImageStyle>;
    fallbackText?: string; // Optional: If we want to show initials or text on failure
}

export const ServiceImage: React.FC<ServiceImageProps> = ({
    url,
    style,
    ...props
}) => {
    // Generate a blurry placeholder for transition
    const blurhash =
        '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj[';

    if (!url) {
        return (
            <View style={[styles.placeholder, style]}>
                <Image
                    style={[StyleSheet.absoluteFill, { opacity: 0.3, width: '50%', height: '50%' }]}
                    source={require('../../assets/icon.png')}
                    contentFit="contain"
                />
            </View>
        );
    }

    return (
        <Image
            style={[styles.image, style]}
            source={{ uri: url }}
            placeholder={blurhash}
            contentFit="cover"
            transition={300}
            cachePolicy="memory-disk" // aggressive caching
            {...props}
        />
    );
};

const styles = StyleSheet.create({
    image: {
        backgroundColor: COLORS.lightGray,
    },
    placeholder: {
        backgroundColor: COLORS.lightGray,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
