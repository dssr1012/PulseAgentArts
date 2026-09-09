// ============================================================
// PulseExpends - Category Quick-Select Grid
// ============================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { CATEGORY_GRID_COLUMNS } from '../constants/categories';
import type { Category } from '../types';

interface CategoryGridProps {
  categories: Category[];
  selectedId?: string;
  onSelect: (category: Category) => void;
}

export function CategoryGrid({ categories, selectedId, onSelect }: CategoryGridProps) {
  return (
    <View style={styles.container}>
      {categories.map((category) => {
        const isSelected = category.id === selectedId;
        return (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.item,
              isSelected && styles.selectedItem,
            ]}
            onPress={() => onSelect(category)}
            activeOpacity={0.7}
          >
            <Text style={styles.icon}>{category.icon || '📌'}</Text>
            <Text
              style={[styles.name, isSelected && styles.selectedName]}
              numberOfLines={1}
            >
              {category.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  item: {
    width: `${100 / CATEGORY_GRID_COLUMNS}%` as any,
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedItem: {
    borderColor: Colors.primary,
    backgroundColor: '#EBF5FF',
  },
  icon: {
    fontSize: 24,
    marginBottom: 4,
  },
  name: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  selectedName: {
    color: Colors.primary,
    fontWeight: '700',
  },
});