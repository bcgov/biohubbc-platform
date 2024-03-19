import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import { Button, Card, IconButton } from '@mui/material';
import grey from '@mui/material/colors/grey';
import SecurityRuleCard, { ISecurityRuleCardProps } from './SecurityRuleCard';

interface ISecurityRuleActionCardProps extends ISecurityRuleCardProps {
  action: 'apply' | 'persist' | 'remove';
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 2,
        background: grey[100]
      }}>
      <SecurityRuleCard {...rest} />
      {props.action === 'apply' ? (
        <IconButton onClick={() => onRemove()} aria-label="Remove security rule">
          <Icon path={mdiClose} size={1} />
        </IconButton>
      ) : (
        <Button
          variant={props.action === 'remove' ? 'contained' : 'outlined'}
          color="error"
          sx={{
            width: '6rem',
            fontWeight: 700,
            letterSpacing: '0.02rem'
          }}
          onClick={() => onRemove()}>
          Remove
        </Button>
      )}
    </Card>
  );
};
export default SecurityRuleActionCard;
