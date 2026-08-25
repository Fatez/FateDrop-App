import { Redirect, useLocalSearchParams } from 'expo-router';

export default function LegacyTruePriceRoute() {
  const params = useLocalSearchParams<{ query?: string | string[] }>();
  const query = Array.isArray(params.query) ? params.query[0] : params.query;

  return (
    <Redirect
      href={{
        pathname: '/fatefind',
        params: query ? { query } : {},
      }}
    />
  );
}
