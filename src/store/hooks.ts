import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from './index';

// Pre-typed hooks — use these instead of plain useSelector/useDispatch throughout
// the app to get correct state inference (required by react-redux v9+).
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
