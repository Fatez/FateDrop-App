import { Redirect, useLocalSearchParams } from 'expo-router';

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default function LegacyTruePriceRoute() {
  const params = useLocalSearchParams<{ query?: string | string[] }>();
  const query = first(params.query) || '';
  return <Redirect href={{ pathname: '/fatefind', params: query ? { query } : {} }} />;
}
