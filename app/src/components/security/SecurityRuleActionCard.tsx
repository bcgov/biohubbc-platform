import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import { Card, IconButton } from '@mui/material';
import grey from '@mui/material/colors/grey';
import SecurityRuleCard from './SecurityRuleCard';

interface ISecurityRuleActionCardProps {
  remove: (id: number) => void;
  security_rule_id: number;
  name: string;
  description: string;
}

const SecurityRuleActionCard = (props: ISecurityRuleActionCardProps) => {
  return (
    <Card
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
      <SecurityRuleCard key={props.security_rule_id} title={props.name} subtitle={props.description} />
      <IconButton onClick={() => props.remove(props.security_rule_id)} aria-label="Remove security rule">
        <Icon path={mdiClose} size={1} />
      </IconButton>
    </Card>
  );
};
export default SecurityRuleActionCard;
