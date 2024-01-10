import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import { Card, IconButton } from '@mui/material';
import grey from '@mui/material/colors/grey';
import SecurityRuleCard, { ISecurityRuleCardProps } from './SecurityRuleCard';

interface ISecurityRuleActionCardProps extends ISecurityRuleCardProps {
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
      />
      <IconButton onClick={() => onRemove()} aria-label="Remove security rule">
        <Icon path={mdiClose} size={1} />
      </IconButton>
    </Card>
  );
};
export default SecurityRuleActionCard;
