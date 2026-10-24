package com.lesson.MiniProject;
import java.util.Scanner;
public class jav {
    public static void main(String[] args) {
        int mynum = (int)(Math.random()*100);
        Scanner sc = new Scanner(System.in);
        int usernumber = 0;
        int count = 0;
        do {
            count++;
            System.out.print("Guess my number: ");
            usernumber = sc.nextInt();
            if (usernumber == mynum){
                System.out.println("Wow...You got it!");
                System.out.println("In " + count+" Attempt");
                break;
            }
            else if (usernumber > mynum) {
                System.out.println("Your number is large.");
            }
            else {
                System.out.println("Your number is too small.");
            }
        } while (usernumber >= 0);

        System.out.print("My number was: ");
        System.out.print(mynum);

    }
}