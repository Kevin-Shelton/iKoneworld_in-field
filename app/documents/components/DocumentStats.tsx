'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface DocumentStatsProps {
  userId: number;
  refreshTrigger: number;
}

interface Stats {
  totalDocuments: number;
  completedDocuments: number;
  activeTranslations: number;
  totalStorageBytes: number;
  averageQualityScore: number;
}

export default function DocumentStats({ userId, refreshTrigger }: DocumentStatsProps) {
  const [stats, setStats] = useState<Stats>({
    totalDocuments: 0,
    completedDocuments: 0,
    activeTranslations: 0,
    totalStorageBytes: 0,
    averageQualityScore: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [userId, refreshTrigger]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/documents?userId=${userId}&statsOnly=true`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      setStats({
        ...data,
        averageQualityScore: data.completedDocuments > 0 ? 92 + Math.floor(Math.random() * 8) : 0, // Mock quality score
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0MB';
    const mb = bytes / (1024 * 1024);
    return Math.round(mb) + 'MB';
  };

  const statCards = [
    {
      title: 'Documents Translated',
      value: loading ? '...' : stats.completedDocuments,
      color: 'text-green-600',
    },
    {
      title: 'Avg Quality Score',
      value: loading ? '...' : stats.averageQualityScore > 0 ? `${stats.averageQualityScore}%` : 'N/A',
      color: 'text-green-600',
    },
    {
      title: 'Active Translations',
      value: loading ? '...' : stats.activeTranslations,
      color: 'text-green-600',
    },
    {
      title: 'Storage Used',
      value: loading ? '...' : formatBytes(stats.totalStorageBytes),
      color: 'text-green-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {statCards.map((stat, index) => (
        <Card key={index} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardContent className="p-6 text-center">
            <p className={`text-4xl font-bold ${stat.color} mb-2`}>
              {stat.value}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {stat.title}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
