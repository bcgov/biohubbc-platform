import { Button, List, ListItem, Stack, Typography } from '@mui/material';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonList } from 'components/loading/SkeletonLoaders';
import { CartContextFeature } from 'contexts/cartContext.interface';
import { useCartContext } from 'hooks/useContext';
import { CartFeatureCard } from '../feature/CartFeatureCard';

interface DownloadSidebarCartProps {
  features: CartContextFeature[];
  itemCount: number;
}

export const DownloadSidebarCart = ({ features, itemCount }: DownloadSidebarCartProps) => {
  const { clearCart, removeFromCart } = useCartContext();

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pb: 1 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#697386', textTransform: 'uppercase' }}>
          Items ({itemCount})
        </Typography>
        <Button size="small" onClick={() => void clearCart()} disabled={!features.length} sx={{ fontWeight: 700 }}>
          Clear
        </Button>
      </Stack>

      <LoadingGuard
        isLoading={false}
        isLoadingFallback={<SkeletonList numberOfLines={5} />}
        hasNoData={features.length === 0}
        hasNoDataFallback={<List dense disablePadding />}>
        <List dense disablePadding>
          {features.map((feature, idx) => (
            <ListItem key={`${feature.submission_feature_id}-${idx}`} disableGutters sx={{ width: 1 }}>
              <CartFeatureCard
                label={feature.feature_type_name}
                secured={'secured' in feature ? feature.secured : false}
                onRemove={() => void removeFromCart([feature.submission_feature_id])}
              />
            </ListItem>
          ))}
        </List>
      </LoadingGuard>
    </>
  );
};
