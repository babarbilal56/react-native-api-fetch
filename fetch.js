// src/FetchComponent.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ActivityIndicator, Button } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FetchComponent = ({
  url,
  method = 'GET',
  body = null,
  headers = { 'Content-Type': 'application/json' },
  cacheKey = null,
  pollingInterval = null,
  cacheExpiration = 60000,
  render,
  children,
}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasFetched = useRef(false);
  const isMounted = useRef(true); // Track whether the component is mounted

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const signal = controller.signal;

    try {
      // Check cache if cacheKey is provided
      if (cacheKey) {
        const cachedData = await AsyncStorage.getItem(cacheKey);
        const cachedTime = await AsyncStorage.getItem(`${cacheKey}_time`);
        const currentTime = Date.now();

        if (cachedData && cachedTime && currentTime - parseInt(cachedTime) < cacheExpiration) {
          if (isMounted.current) setData(JSON.parse(cachedData));
          return; // Exit early if using cached data
        }
      }

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null,
        signal,
      });

      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

      const result = await response.json();
      if (isMounted.current) setData(result);

      // Cache the response if a cacheKey is provided
      if (cacheKey) {
        await AsyncStorage.setItem(cacheKey, JSON.stringify(result));
        await AsyncStorage.setItem(`${cacheKey}_time`, Date.now().toString());
      }
    } catch (err) {
      if (err.name !== 'AbortError' && isMounted.current) {
        setError(err.message);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }

    return () => controller.abort();
  }, [url, method, body, headers, cacheKey, cacheExpiration]);

  useEffect(() => {
    isMounted.current = true;
    if (!pollingInterval) return;

    const interval = setInterval(fetchData, pollingInterval);
    return () => {
      clearInterval(interval);
      isMounted.current = false; // Mark component as unmounted when cleanup occurs
    };
  }, [fetchData, pollingInterval]);

  useEffect(() => {
    if (hasFetched.current) return;

    hasFetched.current = true;
    fetchData();
    return () => {
      isMounted.current = false; // Cleanup on unmount
    };
  }, [fetchData]);

  const handleRetry = () => {
    hasFetched.current = false; // Reset the flag to allow refetch
    fetchData();
  };

  if (loading) {
    return (
      <View style={{ alignItems: 'center', marginTop: 20 }}>
        <ActivityIndicator size="large" color="#007BFF" />
        <Text>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ alignItems: 'center', marginTop: 20 }}>
        <Text style={{ color: 'red' }}>Error: {error}</Text>
        <Button title="Retry" onPress={handleRetry} />
      </View>
    );
  }

  if (render) {
    return render({ data, loading, error, retry: handleRetry });
  }

  if (typeof children === 'function') {
    return children({ data, loading, error, retry: handleRetry });
  }

  return (
    <View style={{ padding: 16 }}>
      <Text>{JSON.stringify(data, null, 2)}</Text>
    </View>
  );
};

export default FetchComponent;

