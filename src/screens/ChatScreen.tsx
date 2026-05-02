import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import dayjs from 'dayjs';
import { useChat, ChatMessage } from '../context/ChatContext';
import { useAppSelector } from '../store/hooks';
import { COLORS } from '../config/theme';

type RouteParams = {
    params: {
        bookingId: string;
        customerName: string;
    };
};

const ChatScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<RouteParams, 'params'>>();
    const insets = useSafeAreaInsets();
    const { bookingId, customerName } = route.params;

    const { user } = useAppSelector((state) => state.auth);
    const currentUserId = user?.id || '';

    const {
        messages,
        isTyping,
        setActiveChat,
        sendMessage,
        sendTyping,
    } = useChat();

    const [inputText, setInputText] = useState('');
    const flatListRef = useRef<FlatList>(null);

    const chatMessages = messages[bookingId] || [];

    useEffect(() => {
        setActiveChat(bookingId);
        return () => setActiveChat(null);
    }, [bookingId, setActiveChat]);

    const handleSend = () => {
        if (inputText.trim()) {
            sendMessage(bookingId, inputText.trim());
            setInputText('');
            sendTyping(bookingId, false);
        }
    };

    const handleTextChange = (text: string) => {
        setInputText(text);
        sendTyping(bookingId, text.length > 0);
    };

    const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
        if (item.type === 'SYSTEM') {
            return (
                <View style={styles.systemMessageContainer}>
                    <Text style={styles.systemMessageText}>{item.content}</Text>
                </View>
            );
        }

        const isMe = item.senderId === currentUserId;
        const showAvatar = !isMe && (index === 0 || chatMessages[index - 1].senderId !== item.senderId);

        return (
            <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther]}>
                {!isMe && (
                    <View style={styles.avatarContainer}>
                        {showAvatar ? (
                            <View style={styles.avatarPlaceholder}>
                                <Text style={styles.avatarText}>{item.sender?.name?.charAt(0) || 'C'}</Text>
                            </View>
                        ) : null}
                    </View>
                )}
                
                <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleOther]}>
                    <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextOther]}>
                        {item.content}
                    </Text>
                    <View style={styles.messageFooter}>
                        <Text style={[styles.timeText, isMe ? styles.timeTextMe : styles.timeTextOther]}>
                            {dayjs(item.createdAt).format('HH:mm')}
                        </Text>
                        {isMe && (
                            <Ionicons 
                                name={item.isRead ? "checkmark-done" : "checkmark"} 
                                size={14} 
                                color={item.isRead ? COLORS.primary : "rgba(255,255,255,0.7)"} 
                                style={{ marginLeft: 4 }}
                            />
                        )}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.charcoal} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>{customerName}</Text>
                </View>
                <TouchableOpacity 
                    onPress={() => navigation.navigate('VoiceCall', { bookingId, customerName })} 
                    style={styles.callButton}
                >
                    <Ionicons name="call" size={22} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            {/* Chat Area */}
            <FlatList
                ref={flatListRef}
                data={chatMessages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                contentContainerStyle={styles.listContent}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            />

            {/* Typing Indicator */}
            {isTyping && (
                <View style={styles.typingContainer}>
                    <Text style={styles.typingText}>{customerName} is typing...</Text>
                </View>
            )}

            {/* Input Area */}
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 15) }]}>
                    <TextInput
                        style={styles.input}
                        placeholder="Type a message..."
                        value={inputText}
                        onChangeText={handleTextChange}
                        multiline
                        maxLength={500}
                    />
                    <TouchableOpacity 
                        style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]} 
                        onPress={handleSend}
                        disabled={!inputText.trim()}
                    >
                        <Ionicons name="send" size={20} color="white" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        paddingHorizontal: 15,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.lightGray,
    },
    backButton: {
        padding: 5,
    },
    headerTitleContainer: {
        flex: 1,
        marginLeft: 15,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.charcoal,
    },
    callButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.primaryLight + '40',
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 15,
        paddingBottom: 10,
    },
    systemMessageContainer: {
        alignItems: 'center',
        marginVertical: 10,
    },
    systemMessageText: {
        backgroundColor: '#E9ECEF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        fontSize: 12,
        color: COLORS.darkGray,
        overflow: 'hidden',
    },
    messageRow: {
        flexDirection: 'row',
        marginBottom: 12,
        alignItems: 'flex-end',
    },
    messageRowMe: {
        justifyContent: 'flex-end',
    },
    messageRowOther: {
        justifyContent: 'flex-start',
    },
    avatarContainer: {
        width: 32,
        marginRight: 8,
    },
    avatarPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.mediumGray,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    messageBubble: {
        maxWidth: '75%',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
    },
    messageBubbleMe: {
        backgroundColor: COLORS.primary,
        borderBottomRightRadius: 4,
    },
    messageBubbleOther: {
        backgroundColor: 'white',
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: COLORS.lightGray,
    },
    messageText: {
        fontSize: 15,
        lineHeight: 20,
    },
    messageTextMe: {
        color: 'white',
    },
    messageTextOther: {
        color: COLORS.charcoal,
    },
    messageFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 4,
    },
    timeText: {
        fontSize: 11,
    },
    timeTextMe: {
        color: 'rgba(255,255,255,0.7)',
    },
    timeTextOther: {
        color: COLORS.mediumGray,
    },
    typingContainer: {
        paddingHorizontal: 20,
        paddingVertical: 5,
    },
    typingText: {
        fontSize: 12,
        color: COLORS.mediumGray,
        fontStyle: 'italic',
    },
    inputContainer: {
        flexDirection: 'row',
        paddingHorizontal: 15,
        paddingTop: 10,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: COLORS.lightGray,
        alignItems: 'flex-end',
    },
    input: {
        flex: 1,
        minHeight: 40,
        maxHeight: 100,
        backgroundColor: '#F8F9FA',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingTop: 10,
        paddingBottom: 10,
        marginRight: 10,
        fontSize: 15,
        color: COLORS.charcoal,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 2,
    },
    sendButtonDisabled: {
        backgroundColor: COLORS.lightGreen,
    },
});

export default ChatScreen;
