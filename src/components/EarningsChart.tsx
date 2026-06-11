import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { formatLKR } from '../utils/format';

type ChartType = 'bar' | 'line' | 'pie';

interface EarningsChartProps {
  id?: string;
  type: ChartType;
  data: any[];
  height?: number;
  title?: string;
}

const COLORS = ['#0F172A', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

export const EarningsChart: React.FC<EarningsChartProps> = ({
  id,
  type,
  data,
  height = 300,
  title,
}) => {
  // Custom tooltips to present Rupees (LKR)
  const formatTooltipAmount = (value: number) => {
    return [formatLKR(value), 'Amount'];
  };

  const renderChartContent = () => {
    if (!data || data.length === 0) {
      return (
        <div className="flex w-full h-[240px] items-center justify-center text-slate-400 text-sm font-mono italic">
          No historical activity recorded yet.
        </div>
      );
    }

    switch (type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `LKR ${(val / 1000).toLocaleString()}k`}
              />
              <Tooltip
                formatter={formatTooltipAmount}
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                  fontFamily: 'Inter, sans-serif',
                }}
              />
              <Bar dataKey="volume" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `LKR ${val.toLocaleString()}`}
              />
              <Tooltip
                formatter={formatTooltipAmount}
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                  fontFamily: 'Inter, sans-serif',
                }}
              />
              <Line type="monotone" dataKey="amount" stroke="#10B981" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'pie':
        // Wait, standard pie layout needs label calculations
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={85}
                paddingAngle={4}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={formatTooltipAmount}
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  fontFamily: 'Inter, sans-serif',
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{
                  fontSize: '11px',
                  fontFamily: 'Inter, sans-serif',
                  color: '#64748B',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <div id={id} className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
      {title && <h3 className="mb-6 text-xs font-bold uppercase tracking-wider text-[#64748B]">{title}</h3>}
      {renderChartContent()}
    </div>
  );
};
