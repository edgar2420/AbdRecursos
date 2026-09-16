import { PrismaClient, Prisma } from '@prisma/client';
import { FieldCipher } from '../src/shared/infrastructure/security/FieldCipher';
import bcrypt from 'bcryptjs';

/**
 * Semilla del SGRH.
 *
 * Lo importante aqui son los PARAMETROS LEGALES: el sistema no lleva ningun
 * porcentaje ni monto escrito en el codigo (seccion 6). Estos son los valores
 * iniciales de referencia; RRHH los edita desde la UI cuando cambian por gestion.
 */
const prisma = new PrismaClient();
/** La C.I. va cifrada en reposo; se busca por su huella. */
const cipher = new FieldCipher();

const VALID_FROM = new Date(new Date().getFullYear(), 0, 1);

type ParamSeed = {
  key: string;
  value: string;
  valueType: string;
  unit?: string;
  description: string;
};

const LEGAL_PARAMETERS: ParamSeed[] = [
  // 6.1 Vacaciones por antiguedad (Ley General del Trabajo)
  { key: 'VACATION_TIER1_MIN_YEARS', value: '1', valueType: 'number', unit: 'anios', description: 'Antiguedad minima para tener derecho a vacacion' },
  { key: 'VACATION_TIER1_DAYS', value: '15', valueType: 'number', unit: 'dias habiles', description: 'Dias de vacacion de 1 a 5 anios de antiguedad' },
  { key: 'VACATION_TIER2_MIN_YEARS', value: '5', valueType: 'number', unit: 'anios', description: 'Inicio del segundo tramo de antiguedad' },
  { key: 'VACATION_TIER2_DAYS', value: '20', valueType: 'number', unit: 'dias habiles', description: 'Dias de vacacion de 5 a 10 anios de antiguedad' },
  { key: 'VACATION_TIER3_MIN_YEARS', value: '10', valueType: 'number', unit: 'anios', description: 'Inicio del tercer tramo de antiguedad' },
  { key: 'VACATION_TIER3_DAYS', value: '30', valueType: 'number', unit: 'dias habiles', description: 'Dias de vacacion con mas de 10 anios de antiguedad' },
  { key: 'VACATION_REQUIRE_HR_APPROVAL', value: 'true', valueType: 'boolean', description: 'Si la solicitud requiere una segunda aprobacion de RRHH ademas del supervisor' },
  { key: 'VACATION_COUNT_SATURDAY', value: 'false', valueType: 'boolean', description: 'Si el sabado cuenta como dia habil de vacacion' },
  { key: 'VACATION_CREDIT_ON_GESTION_START', value: 'false', valueType: 'boolean', description: 'Acreditar los dias al INICIAR la gestion (planificacion) en vez de al cumplirla (Ley General del Trabajo)' },

  // 6.2 Lactancia (Ley 3460)
  { key: 'LACTATION_DAILY_MINUTES', value: '60', valueType: 'number', unit: 'minutos', description: 'Permiso diario de lactancia, fraccionable en dos tramos' },
  { key: 'LACTATION_MONTHS', value: '12', valueType: 'number', unit: 'meses', description: 'Vigencia del permiso desde el nacimiento' },
  { key: 'JOB_PROTECTION_MONTHS_AFTER_BIRTH', value: '12', valueType: 'number', unit: 'meses', description: 'Inamovilidad laboral posterior al parto (informativo)' },
  { key: 'LACTATION_ALERT_DAYS', value: '30', valueType: 'number', unit: 'dias', description: 'Anticipacion de la alerta de vencimiento del beneficio' },

  // 6.3 Aguinaldo
  { key: 'AGUINALDO_MIN_MONTHS', value: '3', valueType: 'number', unit: 'meses', description: 'Meses trabajados minimos para tener derecho al aguinaldo' },
  { key: 'DOUBLE_AGUINALDO', value: 'false', valueType: 'boolean', description: 'Se activa cuando el gobierno declara el segundo aguinaldo' },

  // 6.4 Boleta de pago
  { key: 'AFP_EMPLOYEE_RATE', value: '12.71', valueType: 'number', unit: '%', description: 'Aporte laboral AFP sobre el total ganado. Verificar el valor vigente cada gestion.' },
  { key: 'RCIVA_RATE', value: '13', valueType: 'number', unit: '%', description: 'Alicuota del RC-IVA' },
  { key: 'RCIVA_EXEMPT_MINIMUM_WAGES', value: '4', valueType: 'number', unit: 'salarios minimos', description: 'Minimo no imponible del RC-IVA expresado en salarios minimos' },
  { key: 'MINIMUM_WAGE', value: '2750', valueType: 'number', unit: 'Bs', description: 'Salario minimo nacional vigente. Actualizar cada gestion.' },

  // 6.5 Jornada laboral
  { key: 'WORK_HOURS_PER_DAY', value: '8', valueType: 'number', unit: 'horas', description: 'Jornada maxima diaria de referencia' },
  { key: 'WORK_HOURS_PER_WEEK', value: '48', valueType: 'number', unit: 'horas', description: 'Jornada maxima semanal de referencia' },
  { key: 'WORK_DAYS_PER_MONTH', value: '30', valueType: 'number', unit: 'dias', description: 'Base de dias por mes para prorratear el haber basico' },
  { key: 'OVERTIME_DAY_SURCHARGE', value: '100', valueType: 'number', unit: '%', description: 'Recargo de hora extra diurna' },
  { key: 'OVERTIME_NIGHT_SURCHARGE', value: '200', valueType: 'number', unit: '%', description: 'Recargo de hora extra nocturna' },
  { key: 'OVERTIME_HOLIDAY_SURCHARGE', value: '200', valueType: 'number', unit: '%', description: 'Recargo de hora trabajada en feriado' },
];

const DEPARTMENTS = [
  'Gerencia General',
  'Recursos Humanos',
  'Administracion y Finanzas',
  'Operaciones',
  'Tecnologia',
  'Comercial',
];

const POSITIONS = [
  'Gerente General',
  'Jefe de Recursos Humanos',
  'Analista de Recursos Humanos',
  'Contador',
  'Supervisor de Operaciones',
  'Operario',
  'Desarrollador de Software',
  'Ejecutivo Comercial',
];

/** Feriados nacionales de Bolivia con fecha fija. */
const FIXED_HOLIDAYS: [number, number, string][] = [
  [1, 1, 'Anio Nuevo'],
  [1, 22, 'Dia del Estado Plurinacional'],
  [5, 1, 'Dia del Trabajo'],
  [6, 21, 'Anio Nuevo Andino Amazonico'],
  [8, 6, 'Dia de la Independencia'],
  [10, 17, 'Dia de la Dignidad Nacional'],
  [11, 2, 'Dia de Todos los Difuntos'],
  [12, 25, 'Navidad'],
];

async function seedLegalParameters(): Promise<void> {
  for (const param of LEGAL_PARAMETERS) {
    await prisma.legalParameter.upsert({
      where: { key_validFrom: { key: param.key, validFrom: VALID_FROM } },
      update: { value: param.value, description: param.description, unit: param.unit ?? null },
      create: {
        key: param.key,
        value: param.value,
        valueType: param.valueType,
        unit: param.unit ?? null,
        description: param.description,
        validFrom: VALID_FROM,
      },
    });
  }
  console.log(`  ${LEGAL_PARAMETERS.length} parametros legales`);
}

async function seedCatalogs(): Promise<{ departments: Map<string, string>; positions: Map<string, string> }> {
  const departments = new Map<string, string>();
  for (const name of DEPARTMENTS) {
    const row = await prisma.department.upsert({ where: { name }, update: {}, create: { name } });
    departments.set(name, row.id);
  }
  const positions = new Map<string, string>();
  for (const name of POSITIONS) {
    const row = await prisma.position.upsert({ where: { name }, update: {}, create: { name } });
    positions.set(name, row.id);
  }
  console.log(`  ${departments.size} departamentos, ${positions.size} cargos`);
  return { departments, positions };
}

async function seedHolidays(): Promise<void> {
  const year = new Date().getFullYear();
  for (const [month, day, name] of FIXED_HOLIDAYS) {
    const date = new Date(year, month - 1, day);
    await prisma.holiday.upsert({ where: { date }, update: { name }, create: { date, name } });
  }
  console.log(`  ${FIXED_HOLIDAYS.length} feriados nacionales de ${year}`);
}

async function seedSchedules(): Promise<string> {
  const schedule = await prisma.schedule.upsert({
    where: { name: 'Administrativo 08:30-17:00' },
    update: {},
    create: {
      name: 'Administrativo 08:30-17:00',
      startTime: '08:30',
      endTime: '17:00',
      breakMinutes: 60,
      toleranceMinutes: 10,
      weekDays: [1, 2, 3, 4, 5],
    },
  });
  await prisma.schedule.upsert({
    where: { name: 'Operativo 07:00-15:00' },
    update: {},
    create: {
      name: 'Operativo 07:00-15:00',
      startTime: '07:00',
      endTime: '15:00',
      breakMinutes: 30,
      toleranceMinutes: 5,
      weekDays: [1, 2, 3, 4, 5, 6],
    },
  });
  console.log('  2 horarios');
  return schedule.id;
}

interface DemoPerson {
  firstName: string;
  lastName: string;
  ci: string;
  position: string;
  department: string;
  salary: number;
  hireYearsAgo: number;
  email: string;
  role: 'EMPLOYEE' | 'SUPERVISOR' | 'HR' | 'ADMIN';
  isSupervisor?: boolean;
}

const DEMO_PEOPLE: DemoPerson[] = [
  { firstName: 'Edgar Andres', lastName: 'Rojas Apaza', ci: '5551234', position: 'Gerente General', department: 'Gerencia General', salary: 18000, hireYearsAgo: 11, email: 'admin@empresa.bo', role: 'ADMIN' },
  { firstName: 'Carla', lastName: 'Mendoza Vargas', ci: '4432112', position: 'Jefe de Recursos Humanos', department: 'Recursos Humanos', salary: 12000, hireYearsAgo: 6, email: 'rrhh@empresa.bo', role: 'HR' },
  { firstName: 'Luis Fernando', lastName: 'Choque Ticona', ci: '6712398', position: 'Supervisor de Operaciones', department: 'Operaciones', salary: 9500, hireYearsAgo: 4, email: 'supervisor@empresa.bo', role: 'SUPERVISOR', isSupervisor: true },
  { firstName: 'Maria Elena', lastName: 'Quispe Mamani', ci: '7788112', position: 'Operario', department: 'Operaciones', salary: 4200, hireYearsAgo: 2, email: 'empleado@empresa.bo', role: 'EMPLOYEE' },
  { firstName: 'Jorge', lastName: 'Sanchez Rios', ci: '8899221', position: 'Operario', department: 'Operaciones', salary: 4000, hireYearsAgo: 1, email: 'jorge.sanchez@empresa.bo', role: 'EMPLOYEE' },
  { firstName: 'Andrea', lastName: 'Flores Chumacero', ci: '9911223', position: 'Desarrollador de Software', department: 'Tecnologia', salary: 11000, hireYearsAgo: 3, email: 'andrea.flores@empresa.bo', role: 'EMPLOYEE' },
];

const DEMO_PASSWORD = 'Sgrh2026.demo';

async function seedPeople(
  departments: Map<string, string>,
  positions: Map<string, string>,
  scheduleId: string,
): Promise<void> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  let index = 1;
  const created: { id: string; person: DemoPerson }[] = [];

  for (const person of DEMO_PEOPLE) {
    const hireDate = new Date();
    hireDate.setFullYear(hireDate.getFullYear() - person.hireYearsAgo);

    const employee = await prisma.employee.upsert({
      where: { ciHuella: cipher.huella(person.ci) },
      update: {},
      create: {
        employeeCode: `EMP-${String(index).padStart(4, '0')}`,
        firstName: person.firstName,
        lastName: person.lastName,
        ci: cipher.cifrar(person.ci) ?? '',
        ciHuella: cipher.huella(person.ci),
        ciExtension: 'LP',
        email: person.email,
        phone: `7${String(1000000 + index * 137).slice(0, 7)}`,
        hireDate,
        contractType: 'INDEFINIDO',
        baseSalary: new Prisma.Decimal(person.salary),
        bankName: 'Banco Union',
        bankAccount: cipher.cifrar(`100000${String(index).padStart(5, '0')}`),
        afpName: 'Futuro de Bolivia',
        afpNumber: `AFP-${String(index).padStart(6, '0')}`,
        departmentId: departments.get(person.department) ?? null,
        positionId: positions.get(person.position) ?? null,
        emergencyContactName: 'Contacto de emergencia',
        emergencyContactPhone: '70000000',
        emergencyContactRelation: 'Familiar',
      },
    });

    created.push({ id: employee.id, person });

    await prisma.user.upsert({
      where: { email: person.email },
      update: { role: person.role, employeeId: employee.id },
      create: {
        email: person.email,
        passwordHash,
        role: person.role,
        employeeId: employee.id,
      },
    });

    await prisma.scheduleAssignment.createMany({
      data: [{ scheduleId, employeeId: employee.id, validFrom: hireDate }],
      skipDuplicates: true,
    });

    await prisma.employeeHistory.createMany({
      data: [
        {
          employeeId: employee.id,
          changeType: 'HIRE',
          effectiveDate: hireDate,
          newValue: `${person.position} - ${person.department}`,
          notes: 'Alta inicial (semilla)',
        },
      ],
      skipDuplicates: true,
    });

    index++;
  }

  // Segunda pasada: se asigna el supervisor una vez que todos existen.
  const supervisor = created.find((c) => c.person.isSupervisor);
  if (supervisor) {
    await prisma.employee.updateMany({
      where: { id: { in: created.filter((c) => c.person.role === 'EMPLOYEE').map((c) => c.id) } },
      data: { supervisorId: supervisor.id },
    });
  }

  console.log(`  ${DEMO_PEOPLE.length} empleados con usuario (clave: ${DEMO_PASSWORD})`);
}

async function main(): Promise<void> {
  console.log('Sembrando datos iniciales del SGRH...');
  await seedLegalParameters();
  const { departments, positions } = await seedCatalogs();
  await seedHolidays();
  const scheduleId = await seedSchedules();
  await seedPeople(departments, positions, scheduleId);
  console.log('Listo.');
  console.log('');
  console.log('Accesos de prueba:');
  DEMO_PEOPLE.forEach((p) => console.log(`  ${p.role.padEnd(10)} ${p.email}`));
  console.log(`  Contrasena para todos: ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
