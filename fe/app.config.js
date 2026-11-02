module.exports = ({ config }) => {
  const serverUrl =
    process.env.EXPO_PUBLIC_SERVER_URL ||
    process.env.SERVER_URL ||
    process.env.server_url ||
    config.extra?.serverUrl ||
    'https://codon-production-2652.up.railway.app';

  return {
    ...config,
    extra: {
      ...config.extra,
      serverUrl,
    },
  };
};
