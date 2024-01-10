import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import { Card, FormHelperText, IconButton } from '@mui/material';
import grey from '@mui/material/colors/grey';
import SecurityRuleCard, { ISecurityRuleCardProps } from './SecurityRuleCard';

interface ISecurityRuleActionCardProps extends ISecurityRuleCardProps {
  action: 'apply' | 'persist' | 'remove'
  onRemove: () => void;
}

const SecurityRuleActionCard = (props: ISecurityRuleActionCardProps) => {
  const { key, onRemove, ...rest } = props;
  return (
    <Card
      key={key}
      variant="outlined"
      sx={{
        display: 'flex',
        px: 2,
        py: 1.5,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: grey[100]
      }}>
      <SecurityRuleCard
        {...rest}
        actionContent={
          props.action === 'apply'
            ? <FormHelperText sx={(theme) => ({ color: theme.palette.info.dark })}>Will be applied to all features</FormHelperText>
            : (props.action === 'remove'
              ? <FormHelperText sx={(theme) => ({ color: theme.palette.error.main })}>Will be removed from all features</FormHelperText>
              : <></>
            )
        }
      />
      <IconButton onClick={() => onRemove()} aria-label="Remove security rule">
        <Icon path={mdiClose} size={1} />
      </IconButton>
    </Card>
  );
};
export default SecurityRuleActionCard;
