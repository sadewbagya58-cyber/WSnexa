'use client';

import React from 'react';
import { ItemDetailSheet, ItemDetailSheetProps } from '@/components/guest/item-detail-sheet';

export type MenuItemDetailsProps = ItemDetailSheetProps;

export const MenuItemDetails: React.FC<MenuItemDetailsProps> = (props) => {
  return <ItemDetailSheet {...props} />;
};

export { ItemDetailSheet };
