import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { TelemetryPoint } from '../types';

interface WaterMonitorChartProps {
  points: TelemetryPoint[];
  alertThreshold?: number;
  alarmThreshold?: number;
}

export const WaterMonitorChart: React.FC<WaterMonitorChartProps> = ({
  points,
  alertThreshold = 2.2,
  alarmThreshold = 2.5,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, 420);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.45)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.04)');

    const labels = points.map((p) => p.time);
    const waterData = points.map((p) => p.waterLevel);
    const rainData = points.map((p) => p.rainfall);

    const maxWater = Math.max(1.8, ...waterData, alarmThreshold + 0.15);
    const maxRain = Math.max(60, ...rainData, 60);

    const thresholdLinesPlugin = {
      id: 'thresholdLines',
      beforeDraw(chart: Chart) {
        const {
          ctx: chartCtx,
          chartArea,
          scales,
        } = chart;
        const yWater = scales['yWater'];
        if (!yWater || !chartArea) return;

        const { left, right } = chartArea;
        chartCtx.save();
        chartCtx.setLineDash([4, 4]);
        chartCtx.lineWidth = 1.5;

        // Alert level dashed line (1.3m)
        const alertY = yWater.getPixelForValue(alertThreshold);
        chartCtx.strokeStyle = '#f59e0b';
        chartCtx.beginPath();
        chartCtx.moveTo(left, alertY);
        chartCtx.lineTo(right, alertY);
        chartCtx.stroke();

        // Alarm level dashed line (1.7m)
        const alarmY = yWater.getPixelForValue(alarmThreshold);
        chartCtx.strokeStyle = '#ef4444';
        chartCtx.beginPath();
        chartCtx.moveTo(left, alarmY);
        chartCtx.lineTo(right, alarmY);
        chartCtx.stroke();

        chartCtx.restore();
      },
    };

    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      plugins: [thresholdLinesPlugin],
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Rainfall (mm)',
            data: rainData,
            yAxisID: 'yRain',
            backgroundColor: '#38bdf8',
            barThickness: 8,
            borderRadius: 2,
            order: 2,
          },
          {
            type: 'line',
            label: 'Water Level (m)',
            data: waterData,
            yAxisID: 'yWater',
            borderColor: '#1d4ed8',
            borderWidth: 2.5,
            backgroundColor: gradient,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#1d4ed8',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5,
            pointRadius: 4,
            pointHoverRadius: 6,
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            titleFont: { size: 12 },
            bodyFont: { size: 12 },
            padding: 10,
            cornerRadius: 6,
          },
        },
        scales: {
          x: {
            grid: {
              color: '#f1f5f9',
            },
            ticks: {
              color: '#64748b',
              font: { size: 11 },
            },
            title: {
              display: true,
              text: 'Time',
              color: '#0f172a',
              font: { weight: 'bold', size: 12 },
              padding: { top: 8 },
            },
          },
          yWater: {
            type: 'linear',
            position: 'left',
            min: 0.0,
            max: Number(maxWater.toFixed(1)),
            ticks: {
              stepSize: 0.2,
              callback: (val) => `${Number(val).toFixed(1)}m`,
              color: '#0284c7',
              font: { size: 11 },
            },
            title: {
              display: true,
              text: 'Water Level (m)',
              color: '#0284c7',
              font: { weight: 'bold', size: 12 },
            },
            grid: {
              color: '#f1f5f9',
            },
          },
          yRain: {
            type: 'linear',
            position: 'right',
            min: 0,
            max: maxRain,
            ticks: {
              stepSize: 10,
              callback: (val) => `${val}mm`,
              color: '#0d9488',
              font: { size: 11 },
            },
            title: {
              display: true,
              text: 'Rainfall (mm)',
              color: '#0d9488',
              font: { weight: 'bold', size: 12 },
            },
            grid: {
              drawOnChartArea: false,
            },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [points, alertThreshold, alarmThreshold]);

  return (
    <div className="relative w-full h-[430px] mt-2">
      <canvas ref={canvasRef} />
    </div>
  );
};
