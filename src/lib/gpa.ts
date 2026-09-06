// Nigerian 5-point grading scale
export const letterToGPA = (letter: string): number => {
  switch (letter) {
    case "A": case "A1":
      return 5.0;
    case "B": case "B2": case "B3":
      return 4.0;
    case "C": case "C4": case "C5": case "C6":
      return 3.0;
    case "D": case "D7":
      return 2.0;
    case "E": case "E8":
      return 1.0;
    case "F": case "F9":
      return 0.0;
    default:
      return 0.0;
  }
};

export const calculatePercentageToLetter = (percentage: number, isHigherEd: boolean): string => {
  if (isHigherEd) {
    if (percentage >= 70) return "A";
    if (percentage >= 60) return "B";
    if (percentage >= 50) return "C";
    if (percentage >= 45) return "D";
    if (percentage >= 40) return "E";
    return "F";
  } else {
    // WAEC/NECO Standard
    if (percentage >= 75) return "A1";
    if (percentage >= 70) return "B2";
    if (percentage >= 65) return "B3";
    if (percentage >= 60) return "C4";
    if (percentage >= 55) return "C5";
    if (percentage >= 50) return "C6";
    if (percentage >= 45) return "D7";
    if (percentage >= 40) return "E8";
    return "F9";
  }
};

export const getDegreeClass = (cgpa: number): string => {
  if (cgpa >= 4.50) return "First Class";
  if (cgpa >= 3.50) return "Second Class Upper";
  if (cgpa >= 2.40) return "Second Class Lower";
  if (cgpa >= 1.50) return "Third Class";
  if (cgpa >= 1.00) return "Pass";
  return "Fail";
};

// Expects raw exam results joined with Exam -> Course -> Tier
export const aggregateTranscripts = (examResults: any[]) => {
  const semestersMap = new Map<string, Map<string, { courseName: string, courseCode: string, totalScore: number, totalMaxScore: number, isHigherEd: boolean }>>();

  for (const result of examResults) {
    const exam = result.exam;
    const course = exam.course;
    const semester = exam.semester || "Unknown Semester";
    
    // Check if the tier implies higher ed
    const tierName = course.tier?.name || "";
    const isHigherEd = tierName.toLowerCase().includes("higher") || tierName.toLowerCase().includes("university") || tierName.toLowerCase().includes("college");

    if (!semestersMap.has(semester)) {
      semestersMap.set(semester, new Map());
    }
    
    const coursesMap = semestersMap.get(semester)!;

    if (!coursesMap.has(course.id)) {
      coursesMap.set(course.id, {
        courseName: course.name,
        courseCode: course.code,
        totalScore: 0,
        totalMaxScore: 0,
        isHigherEd
      });
    }

    const mapData = coursesMap.get(course.id)!;
    mapData.totalScore += result.score;
    mapData.totalMaxScore += exam.maxScore;
  }

  let overallGPAPoints = 0;
  let overallCourseCount = 0;
  let hasHigherEdCourse = false;

  const semestersData = Array.from(semestersMap.entries()).map(([semester, coursesMap]) => {
    let semesterGPAPoints = 0;
    const courseGrades: any[] = [];

    coursesMap.forEach((data, courseId) => {
      const finalPercentage = (data.totalScore / data.totalMaxScore) * 100;
      const finalLetter = calculatePercentageToLetter(finalPercentage, data.isHigherEd);
      const gpaPoints = letterToGPA(finalLetter);
      
      if (data.isHigherEd) hasHigherEdCourse = true;

      semesterGPAPoints += gpaPoints;
      overallGPAPoints += gpaPoints;
      overallCourseCount++;
      
      courseGrades.push({
        courseId,
        courseName: data.courseName,
        courseCode: data.courseCode,
        percentage: finalPercentage.toFixed(1),
        letterGrade: finalLetter,
        gpaPoints: gpaPoints.toFixed(1)
      });
    });

    const semesterGPA = courseGrades.length > 0 
      ? (semesterGPAPoints / courseGrades.length).toFixed(2)
      : "0.00";

    return {
      semester,
      courseGrades,
      semesterGPA
    };
  });

  const cumulativeGPANum = overallCourseCount > 0 ? (overallGPAPoints / overallCourseCount) : 0;
  const cumulativeGPA = cumulativeGPANum.toFixed(2);
  const degreeClass = hasHigherEdCourse ? getDegreeClass(cumulativeGPANum) : null;

  return {
    semesters: semestersData,
    cumulativeGPA,
    degreeClass
  };
};
