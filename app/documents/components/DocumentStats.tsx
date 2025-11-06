'use client';

import { useState, useEffect } from 'react';
import { FileText, Activity, HardDrive } from 'lucide-react';
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
}

export default function DocumentStats({ userId, refreshTrigger }: DocumentStatsProps) {
  const [stats, setStats] = useState<Stats>({
    totalDocuments: 0,
    completedDocuments: 0,
    activeTranslations: 0,
    totalStorageBytes: 0,
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
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const statCards = [
    {
      title: 'Documents Translated',
      value: loading ? '...' : stats.completedDocuments,
      icon: FileText,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      title: 'Active Translations',
      value: loading ? '...' : stats.activeTranslations,
      icon: Activity,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      title: 'Storage Used',
      value: loading ? '...' : formatBytes(stats.totalStorageBytes),
      icon: HardDrive,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {statCards.map((stat, index) => (
        <Card key={index} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-black dark:text-gray-300 mb-1">
                  {stat.title}
                </p>
                <p className={`text-2xl font-bold ${stat.color}`}>
                  {stat.value}
                </p>
              </div>
              <div className={`p-3 rounded-full ${stat.bgColor}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
